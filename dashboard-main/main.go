package main

import (
	"fmt"
	"os"
	"os/exec"
)

func main() {
	fmt.Println("Starting dashboard...")

	// Change to server directory and run the server binary
	serverBinary := "./server/dashboard-server"

	// Check if the binary exists
	if _, err := os.Stat(serverBinary); os.IsNotExist(err) {
		fmt.Printf("Server binary not found at %s. Building...\n", serverBinary)
		// Build the server first
		cmd := exec.Command("make", "build")
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			fmt.Printf("Failed to build server: %v\n", err)
			os.Exit(1)
		}
	}

	// Run the server binary
	cmd := exec.Command(serverBinary)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		fmt.Printf("Failed to run server: %v\n", err)
		os.Exit(1)
	}
}
