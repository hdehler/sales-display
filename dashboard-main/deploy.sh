#!/bin/bash
set -e

# Deployment script for dashboard to Proxmox VM
VM_IP="10.80.1.96"
VM_USER="${VM_USER:-orca}"  # Default to orca user, but can be overridden
SSH_KEY="${SSH_KEY:-~/.ssh/id_pants}"  # Use specific SSH key for Proxmox

echo "🚀 Deploying dashboard to Proxmox VM at $VM_IP as user $VM_USER"

# Check if deb file exists
if [ ! -f "ansible/roles/dashboard/files/dashboard.deb" ]; then
    echo "❌ Dashboard .deb file not found. Run 'make deb' first."
    exit 1
fi

# SSH options for using specific key and avoiding host key checking
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no"

# Copy deb file to VM
echo "📦 Copying dashboard.deb to VM..."
scp $SSH_OPTS ansible/roles/dashboard/files/dashboard.deb $VM_USER@$VM_IP:/tmp/dashboard.deb

# Copy environment file to VM
echo "📝 Copying environment file..."
scp $SSH_OPTS server/.env.prod $VM_USER@$VM_IP:/tmp/.env.prod

# Install and configure on VM
echo "⚙️  Installing dashboard on VM..."
ssh $SSH_OPTS $VM_USER@$VM_IP << 'EOF'
    # Install the package
    sudo dpkg -i /tmp/dashboard.deb
    
    # Setup environment file
    sudo mkdir -p /etc/dashboard
    sudo cp /tmp/.env.prod /etc/dashboard/.env.prod
    sudo chmod 644 /etc/dashboard/.env.prod
    
    # Enable and start the service
    sudo systemctl daemon-reload
    sudo systemctl enable dashboard.service
    sudo systemctl start dashboard.service
    
    # Show status
    sudo systemctl status dashboard.service --no-pager -l
    
    # Clean up
    rm /tmp/dashboard.deb /tmp/.env.prod
EOF

echo "✅ Deployment complete! Dashboard should be running at http://$VM_IP:8080"
