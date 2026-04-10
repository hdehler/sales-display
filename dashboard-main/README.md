# hw

hw is a WireGuard VPN and network hw for devices and cloud virts. It also serves as a jump server for SSH connections to box devices.

## Building
Build and run the cloud binary:
```
git clone git@github.com:slidehq/hw.git
cd hw
make build-deps-ubuntu
make build
dist/hw_linux_amd64_linux_amd64_v1/hw --help
```

To install it to your system, you may also run (optional):
```
make build install
hw --help
```
