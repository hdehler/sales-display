#!/bin/bash
set -e

# Manual deployment helper for dashboard
VM_IP="10.80.1.96"

echo "🚀 Preparing dashboard deployment files"

# Check if deb file exists
if [ ! -f "ansible/roles/dashboard/files/dashboard.deb" ]; then
    echo "❌ Dashboard .deb file not found. Run 'make deb' first."
    exit 1
fi

# Create deployment directory
mkdir -p deployment_files

# Copy files to deployment directory
cp ansible/roles/dashboard/files/dashboard.deb deployment_files/
cp server/.env.prod deployment_files/

# Create installation script for the VM
cat > deployment_files/install_dashboard.sh << 'EOF'
#!/bin/bash
set -e

echo "Installing dashboard on VM..."

# Install the package
sudo dpkg -i dashboard.deb

# Setup environment file
sudo mkdir -p /etc/dashboard
sudo cp .env.prod /etc/dashboard/.env.prod
sudo chmod 644 /etc/dashboard/.env.prod

# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable dashboard.service
sudo systemctl start dashboard.service

# Show status
sudo systemctl status dashboard.service --no-pager

echo "✅ Dashboard installation complete!"
EOF

chmod +x deployment_files/install_dashboard.sh

echo "📁 Deployment files ready in ./deployment_files/"
echo "📋 Manual deployment steps:"
echo "   1. Copy the deployment_files folder to your VM at 10.80.1.96"
echo "   2. On the VM, run: cd deployment_files && ./install_dashboard.sh"
echo ""
echo "🔧 Alternative: Use Proxmox web interface to upload files to the VM"
