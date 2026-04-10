package main

import (
	"database/sql"
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"sort"
	"sync"
	"time"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

type cache[T any] struct {
	mu        sync.Mutex
	data      T
	fetchedAt time.Time
	ttl       time.Duration
}

func (c *cache[T]) get(fetch func() (T, error)) (T, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if time.Since(c.fetchedAt) < c.ttl {
		return c.data, nil
	}
	data, err := fetch()
	if err != nil {
		return c.data, err
	}
	c.data = data
	c.fetchedAt = time.Now()
	return data, nil
}

//go:embed web
var webFiles embed.FS

func loadEnv() {
	env := os.Getenv("APP_ENV") // e.g., "stage" or "prod"

	var envFile string
	switch env {
	case "prod":
		envFile = ".env.prod"
	case "stage":
		envFile = ".env.stage"
	case "dev":
		envFile = ".env.dev"
	default:
		envFile = ".env.prod"
	}

	// Load from absolute path for production, or local path for development
	var err error
	if env == "dev" {
		// Try local directory first for development
		err = godotenv.Load(envFile)
	} else {
		err = godotenv.Load("/etc/dashboard/" + envFile)
	}
	if err != nil {
		log.Fatalf("Error loading environment file %s: %v", envFile, err)
	}
}

// getDeviceCount retrieves the count of active devices from the database
func getDeviceCount(db *sql.DB) (int, error) {
	var count int

	query := `
        SELECT COUNT(*) AS active_device_count
		FROM device_config dc
		JOIN account a ON dc.account_id = a.account_id AND a.deleted IS NULL
		WHERE dc.deleted IS NULL
			AND a.account_type = 'partner'
			AND dc.state = 'active';
    `

	/*SELECT COUNT(*) AS active_device_count
	        FROM device_config dc
	        JOIN account a ON dc.account_id = a.account_id
			JOIN service_instance si ON dc.service_instance_id = si.service_instance_id
			JOIN stripe_subscription ss ON si.stripe_subscription_id = ss.stripe_subscription_id
	        WHERE a.account_type = 'partner'
			  AND ss.deleted IS NULL
			  AND dc.deleted IS NULL*/

	err := db.QueryRow(query).Scan(&count)
	if err != nil {
		return 0, err
	}

	return count, nil
}

func getPartnerStats(db *sql.DB) (int, int, error) {
	var totalPartners int
	var newThisQuarter int

	query := `
	SELECT
		(SELECT COUNT(DISTINCT dc.account_id)
		 FROM device_config dc
		 JOIN account a ON a.account_id = dc.account_id
		 WHERE dc.state = 'active'
		   AND dc.deleted IS NULL
		   AND a.account_type = 'partner'
		) AS total,
		(SELECT COUNT(DISTINCT acc.account_id)
		 FROM "order" o
		 JOIN stripe_quote sq ON o.stripe_quote_id = sq.stripe_quote_id
		 JOIN account acc ON sq.stripe_customer_id = acc.stripe_customer_id
		 WHERE acc.account_type = 'partner'
		   AND o.deleted IS NULL
		   AND o.created >= date_trunc('quarter', CURRENT_DATE)
		   AND acc.account_id NOT IN (
		     SELECT DISTINCT acc2.account_id
		     FROM "order" o2
		     JOIN stripe_quote sq2 ON o2.stripe_quote_id = sq2.stripe_quote_id
		     JOIN account acc2 ON sq2.stripe_customer_id = acc2.stripe_customer_id
		     WHERE acc2.account_type = 'partner'
		       AND o2.deleted IS NULL
		       AND o2.created < date_trunc('quarter', CURRENT_DATE)
		   )
		) AS new_this_quarter
	`

	err := db.QueryRow(query).Scan(&totalPartners, &newThisQuarter)
	if err != nil {
		return 0, 0, err
	}

	return totalPartners, newThisQuarter, nil
}

func getOrderStats(db *sql.DB) (int, int, error) {
	var total_orders int
	var thisQuarter int

	query := `
	SELECT
		COUNT(DISTINCT o.order_id) AS total_orders,
		COUNT(DISTINCT o.order_id) FILTER (
			WHERE o.created >= date_trunc('quarter', CURRENT_DATE)
		) AS this_quarter
	FROM "order" o
	JOIN stripe_quote sq ON o.stripe_quote_id = sq.stripe_quote_id AND sq.deleted IS NULL
	JOIN account acc ON sq.stripe_customer_id = acc.stripe_customer_id AND acc.deleted IS NULL
	WHERE acc.account_type = 'partner'
	AND o.deleted IS NULL;
    `

	err := db.QueryRow(query).Scan(&total_orders, &thisQuarter)
	if err != nil {
		fmt.Println("SQL query error:", err)
		return 0, 0, err
	}

	return total_orders, thisQuarter, nil
}

type RecentOrder struct {
	OrderID    string `json:"order_id"`
	Customer   string `json:"customer"`
	Model      string `json:"model"`
	Date       string `json:"date"`
	Created    string `json:"created"`
	Status     string `json:"status"`
	Line1      string `json:"line1"`
	City       string `json:"city"`
	State      string `json:"state"`
	PostalCode string `json:"postal_code"`
	Country    string `json:"country"`
}

func getRecentOrders(db *sql.DB) ([]RecentOrder, error) {
	query := `
    SELECT 
    o.order_id,
    acc.account_name,
    hm.model_name,
    o.created,
    o.status,
    a.line1,
    a.city,
    a.state,
    a.postal_code,
    a.country
FROM "order" o
LEFT JOIN hardware_model hm ON o.hardware_stripe_product_id = hm.stripe_product_id
JOIN address a ON o.shipping_address_id = a.address_id
LEFT JOIN stripe_quote sq ON o.stripe_quote_id = sq.stripe_quote_id
LEFT JOIN account acc ON sq.stripe_customer_id = acc.stripe_customer_id
WHERE o.deleted IS NULL
ORDER BY o.created DESC
LIMIT 50;

	`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	orderMap := make(map[string]RecentOrder)

	for rows.Next() {
		var o RecentOrder
		var created time.Time

		if err := rows.Scan(
			&o.OrderID,
			&o.Customer,
			&o.Model,
			&created,
			&o.Status,
			&o.Line1,
			&o.City,
			&o.State,
			&o.PostalCode,
			&o.Country,
		); err != nil {
			return nil, err
		}

		o.Date = timeAgo(created)
		o.Created = created.Format(time.RFC3339)

		// Deduplicate by order ID
		if _, exists := orderMap[o.OrderID]; !exists {
			orderMap[o.OrderID] = o
		}
	}

	// Convert map to slice
	var orders []RecentOrder
	for _, order := range orderMap {
		orders = append(orders, order)
	}

	// Sort by Created descending
	sort.Slice(orders, func(i, j int) bool {
		t1, _ := time.Parse(time.RFC3339, orders[i].Created)
		t2, _ := time.Parse(time.RFC3339, orders[j].Created)
		return t1.After(t2)
	})

	return orders, nil
}

func timeAgo(t time.Time) string {
	duration := time.Since(t)

	switch {
	case duration < time.Minute:
		return "Just now"
	case duration < time.Hour:
		return fmt.Sprintf("%d minutes ago", int(duration.Minutes()))
	case duration < 24*time.Hour:
		return fmt.Sprintf("%d hours ago", int(duration.Hours()))
	case duration > 24*time.Hour && duration < 48*time.Hour:
		return "1 day ago"
	default:
		return fmt.Sprintf("%d days ago", int(duration.Hours()/24))
	}
}

// getting the active quotes
func getActiveQuotes(db *sql.DB) (int, error) {
	var count int
	query := `
		SELECT COUNT(*)
		FROM stripe_quote
		where stripe_quote_json->> 'status' = 'open'
	`
	err := db.QueryRow(query).Scan(&count)
	if err != nil {
		return 0, err
	}
	return count, nil
}

type dailyCount struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

func getDailyCounts(db *sql.DB) ([]dailyCount, error) {
	query := `
	SELECT
		o.created::date AS day,
		COUNT(DISTINCT o.order_id) AS count
	FROM "order" o
	WHERE o.deleted IS NULL
	AND o.created >= NOW() - INTERVAL '30 days'
	GROUP BY day
	ORDER BY day;
	`
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []dailyCount
	for rows.Next() {
		var dc dailyCount
		var day time.Time
		if err := rows.Scan(&day, &dc.Count); err != nil {
			return nil, err
		}
		dc.Date = day.Format("2006-01-02")
		results = append(results, dc)
	}
	return results, nil
}

type modelCount struct {
	Model string `json:"model"`
	Count int    `json:"count"`
}

func getSalesBreakdown(db *sql.DB) ([]modelCount, error) {
	query := `
	SELECT COALESCE(hm.model_name, 'Unknown') AS model_name, COUNT(DISTINCT o.order_id) AS count
	FROM "order" o
	LEFT JOIN hardware_model hm ON o.hardware_stripe_product_id = hm.stripe_product_id
	WHERE o.deleted IS NULL
	GROUP BY hm.model_name
	ORDER BY count DESC;
	`
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []modelCount
	for rows.Next() {
		var mc modelCount
		if err := rows.Scan(&mc.Model, &mc.Count); err != nil {
			return nil, err
		}
		results = append(results, mc)
	}
	return results, nil
}

type monthlyCount struct {
	Year  int `json:"year"`
	Month int `json:"month"`
	Count int `json:"count"`
}

func getMonthlySales(db *sql.DB) ([]monthlyCount, error) {
	query := `
	SELECT
		EXTRACT(YEAR FROM o.created)::int AS year,
		EXTRACT(MONTH FROM o.created)::int AS month,
		COUNT(DISTINCT o.order_id) AS count
	FROM "order" o
	WHERE o.deleted IS NULL
	AND o.created >= NOW() - INTERVAL '12 months'
	GROUP BY year, month
	ORDER BY year, month;
	`
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []monthlyCount
	for rows.Next() {
		var mc monthlyCount
		if err := rows.Scan(&mc.Year, &mc.Month, &mc.Count); err != nil {
			return nil, err
		}
		results = append(results, mc)
	}
	return results, nil
}

type partnerStats struct {
	total       int
	thisQuarter int
}

type orderStats struct {
	total       int
	thisQuarter int
}

func main() {
	loadEnv()

	// web files
	staticFS, err := fs.Sub(webFiles, "web")
	if err != nil {
		log.Fatal(err)
	}
	http.Handle("/", http.FileServer(http.FS(staticFS)))

	fmt.Println("Starting Go backend...")

	// Connect to the PostgreSQL database
	host := os.Getenv("DB_HOST")
	port := os.Getenv("DB_PORT")
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	dbname := os.Getenv("DB_NAME")
	sslmode := os.Getenv("DB_SSLMODE")
	sslcert := os.Getenv("DB_SSL_ROOT_CERT")

	fmt.Println("Connecting to the database...")

	psqlInfo := fmt.Sprintf("host=%s port=%s user=%s password='%s' dbname=%s sslmode='%s' sslrootcert='%s'",
		host, port, user, password, dbname, sslmode, sslcert)

	db, err := sql.Open("postgres", psqlInfo)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// ping to check connection
	if err := db.Ping(); err != nil {
		log.Fatal("failed to connect to the database:", err)
	}

	fmt.Println("Connected to the database successfully!")

	deviceCountCache := &cache[int]{ttl: 5 * time.Minute}
	partnerStatsCache := &cache[partnerStats]{ttl: 5 * time.Minute}
	orderStatsCache := &cache[orderStats]{ttl: 5 * time.Minute}
	recentOrdersCache := &cache[[]RecentOrder]{ttl: 60 * time.Second}
	activeQuotesCache := &cache[int]{ttl: 5 * time.Minute}
	salesBreakdownCache := &cache[[]modelCount]{ttl: 5 * time.Minute}
	monthlySalesCache := &cache[[]monthlyCount]{ttl: 5 * time.Minute}
	dailyCountsCache := &cache[[]dailyCount]{ttl: 60 * time.Second}

	// active devices endpoint
	http.HandleFunc("/api/active-devices", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")

		count, err := deviceCountCache.get(func() (int, error) {
			return getDeviceCount(db)
		})
		if err != nil {
			http.Error(w, "Device Count Database query failed", http.StatusInternalServerError)
			log.Println("Query error:", err)
			return
		}

		fmt.Fprintf(w, "%d", count)
	})

	// logo count endpoint
	http.HandleFunc("/api/partner-stats", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		stats, err := partnerStatsCache.get(func() (partnerStats, error) {
			total, thisQuarter, err := getPartnerStats(db)
			return partnerStats{total: total, thisQuarter: thisQuarter}, err
		})
		if err != nil {
			http.Error(w, "Failed to fetch partner stats", http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]int{
			"total":       stats.total,
			"thisQuarter": stats.thisQuarter,
		})
	})

	// order count endpoint
	http.HandleFunc("/api/total-orders", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		stats, err := orderStatsCache.get(func() (orderStats, error) {
			total, thisQuarter, err := getOrderStats(db)
			return orderStats{total: total, thisQuarter: thisQuarter}, err
		})
		if err != nil {
			log.Println("Error getting order stats:", err)
			http.Error(w, "Failed to fetch order stats", http.StatusInternalServerError)
			return
		}

		err = json.NewEncoder(w).Encode(map[string]int{
			"total":     stats.total,
			"thisMonth": stats.thisQuarter,
		})
		if err != nil {
			log.Println("Error encoding JSON:", err)
		}
	})

	http.HandleFunc("/api/recent-orders", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		orders, err := recentOrdersCache.get(func() ([]RecentOrder, error) {
			return getRecentOrders(db)
		})
		if err != nil {
			log.Println("Error getting recent orders:", err)
			http.Error(w, "Failed to fetch recent orders", http.StatusInternalServerError)
			return
		}
		err = json.NewEncoder(w).Encode(orders)
		if err != nil {
			log.Println("Error encoding JSON:", err)
		}
	})

	http.HandleFunc("/api/daily-counts", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		data, err := dailyCountsCache.get(func() ([]dailyCount, error) {
			return getDailyCounts(db)
		})
		if err != nil {
			log.Println("Error getting daily counts:", err)
			http.Error(w, "Failed to fetch daily counts", http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(data)
	})

	http.HandleFunc("/api/sales-breakdown", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		data, err := salesBreakdownCache.get(func() ([]modelCount, error) {
			return getSalesBreakdown(db)
		})
		if err != nil {
			log.Println("Error getting sales breakdown:", err)
			http.Error(w, "Failed to fetch sales breakdown", http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(data)
	})

	http.HandleFunc("/api/monthly-sales", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		data, err := monthlySalesCache.get(func() ([]monthlyCount, error) {
			return getMonthlySales(db)
		})
		if err != nil {
			log.Println("Error getting monthly sales:", err)
			http.Error(w, "Failed to fetch monthly sales", http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(data)
	})

	// active quotes endpoint
	http.HandleFunc("/api/active-quotes", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		count, err := activeQuotesCache.get(func() (int, error) {
			return getActiveQuotes(db)
		})
		if err != nil {
			log.Println("Error getting active quotes:", err)
			http.Error(w, "Failed to fetch active quotes", http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]int{
			"activeQuotes": count,
		})
	})
	fmt.Println("Backend running on http://localhost:8080")
	log.Fatal(http.ListenAndServe("0.0.0.0:8080", nil))
}
