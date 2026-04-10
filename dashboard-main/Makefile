# Dashboard Makefile
# This Makefile provides targets for building, packaging, and deploying the dashboard application

# Default to "prod" if not set
ENV ?= prod
MAKEFLAGS := --jobs=1
GO := go
VERSION := $(shell git describe --tag 2>/dev/null || echo "dev")
COMMIT := $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")

.PHONY: build clean run deb reinstall install playbook clearDeb deploy help test check fmt lint web web-build web-deps

help:
	@echo "Typical commands (more see below):"
	@echo "  make build                      - Build complete application"
	@echo "  make run                        - Build and run locally"
	@echo "  make deploy                     - Deploy to remote VM"
	@echo "  make check                      - Run all tests, vetting/formatting checks and linters"
	@echo
	@echo "Build everything:"
	@echo "  make build                      - Build complete application (web + backend)"
	@echo "  make clean                      - Clean build/dist folders"
	@echo "  make web                        - Build web frontend only"
	@echo
	@echo "Test/check:"
	@echo "  make test                       - Run tests"
	@echo "  make check                      - Run tests and linting"
	@echo
	@echo "Lint/format:"
	@echo "  make fmt                        - Run formatting"
	@echo "  make lint                       - Run linting"
	@echo
	@echo "Package/deploy:"
	@echo "  make deb                        - Create Debian package"
	@echo "  make deploy                     - Deploy to Proxmox VM"
	@echo "  make reinstall                  - Rebuild and reinstall locally"
	@echo

# Build the complete dashboard application (frontend + backend)
# - Compiles React frontend to static files
# - Embeds the frontend files into the Go backend  
# - Builds the Go binary
build: web
	# Build Go backend with embedded frontend
	cd server && $(GO) build -o dist/dashboard-server

# Build web frontend and embed into server
web: web-deps web-build

# Build React frontend and move to server directory (like console)
web-build:
	cd web && npm run build
	# Clean and prepare server/web directory
	rm -rf server/web
	mkdir -p server/web
	cp -r web/build/* server/web/

# Install web dependencies
web-deps:
	cd web && npm install --no-save

# Update web dependencies
web-update:
	cd web && npm update

# Clean up all build artifacts and temporary files
# - Removes web build output
# - Removes compiled Go binary  
# - Removes goreleaser distribution files
clean:
	# Cleaning up the build artifacts
	rm -rf server/web
	rm -f server/dist/dashboard-server
	rm -rf web/build
	rm -rf dist/

# Build and run the dashboard server locally for development/testing
# - Builds the complete application
# - Starts the Go server with the specified environment (default: prod)
# - Server will be available at http://localhost:8080
run: build
	cd server && APP_ENV=$(ENV) ./dist/dashboard-server

# Test/check targets

check: lint test

# Run web tests
test-web: web-deps
	cd web && npm run test

# Run Go tests  
test-go: web-build
	cd server && $(GO) test $(shell cd server && $(GO) list ./... 2>/dev/null || echo ".")

# Run all tests
test: test-web test-go

# Run tests with verbose output
testv:
	cd server && $(GO) test -v $(shell cd server && $(GO) list ./... 2>/dev/null || echo ".")

# Run tests with race detection
race:
	cd server && $(GO) test -v -race $(shell cd server && $(GO) list ./... 2>/dev/null || echo ".")

# Lint/formatting targets

# Format web code
fmt-web: web-deps
	cd web && npm run format || echo "No format script found"

# Format Go code
fmt-go:
	gofmt -s -w .
	$(GO) install mvdan.cc/gofumpt@latest || echo "gofumpt install failed"
	which gofumpt && gofumpt -w . || echo "gofumpt not available"

# Format all code
fmt: fmt-web fmt-go

# Lint web code
lint-web: web-deps
	cd web && npm run lint || echo "No lint script found"

# Lint Go code
lint-go: web
	$(GO) install github.com/golangci/golangci-lint/cmd/golangci-lint@latest || echo "golangci-lint install failed"
	which golangci-lint && golangci-lint run || echo "golangci-lint not available, using go vet"
	$(GO) vet ./...

# Lint all code  
lint: lint-web lint-go

# Check for vulnerabilities
vulncheck:
	$(GO) install golang.org/x/vuln/cmd/govulncheck@latest || echo "govulncheck install failed"
	which govulncheck && govulncheck ./... || echo "govulncheck not available"

# Remove an existing dashboard installation completely
# - Stops and disables the systemd service
# - Removes the debian package
# - Cleans up all service files and directories
# - Reloads systemd configuration
clearDeb:
	# Stop and disable the service
	sudo systemctl stop dashboard.service || true
	sudo systemctl disable dashboard.service || true
	sudo systemctl reset-failed dashboard.service || true

	# Remove the installed package
	sudo apt remove -y dashboard || true

	# Reload systemd state
	sudo systemctl daemon-reexec
	sudo systemctl daemon-reload

	# Remove all installed files and service definitions
	sudo rm -rf /opt/dashboard
	sudo rm -rf /etc/dashboard
	sudo rm -rf /var/log/dashboard
	sudo rm -f /lib/systemd/system/dashboard.service

# Create a Debian package (.deb) for distribution and deployment
# - Builds the complete application first
# - Uses goreleaser to create a .deb package with proper metadata
# - Copies the .deb file to ansible/roles/dashboard/files/ for deployment
deb: build
	goreleaser release --snapshot --clean

	# Copy the deb to Ansible role so it can install it
	mkdir -p ansible/roles/dashboard/files
	cp dist/*_linux_amd64.deb ansible/roles/dashboard/files/dashboard.deb

# Install the dashboard package on the local system
# - Installs the .deb package using dpkg
# - Sets up the environment configuration file
# - Configures and starts the systemd service
# - Service will be available at http://localhost:8080
install:
	# download the deb file
	sudo dpkg -i ansible/roles/dashboard/files/dashboard.deb
	# copy env file after install
	sudo mkdir -p /etc/dashboard
	sudo cp server/.env.prod /etc/dashboard/.env.prod
	sudo chmod 644 /etc/dashboard/.env.prod
	# start the service
	sudo systemctl daemon-reexec
	sudo systemctl daemon-reload
	sudo systemctl restart dashboard.service

# Full rebuild and reinstall cycle for local development
# - Creates a new .deb package
# - Installs it on the local system
# - Useful for testing packaging and installation process

################ NOTE #################
#USE THIS -Harry
reinstall: deb install

# Deploy the dashboard to a remote Proxmox VM
# - Creates a .deb package
# - Runs the deployment script to install on remote VM (10.80.1.96)
# - Uses SSH key authentication for passwordless deployment
# - Dashboard will be available at http://10.80.1.96:8080

################ NOTE #################
#then use this to deploy harry
deploydashboard: deb
	./deploy.sh

# Run Ansible playbook for dashboard deployment (alternative deployment method)
# - Uses Ansible to deploy dashboard locally
# - Requires sudo password for local installation
# - Alternative to the direct deployment script
playbook:
	cd ansible && ansible-playbook test-dashboard.yml --connection=local --ask-become-pass
