#!/bin/bash
# Delete Oracle Cloud VM and VCN. Usage: ./teardown-vm.sh [--force]
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/vm-config.env"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

[[ ! -f "$CONFIG_FILE" ]] && { log_error "Config not found: $CONFIG_FILE"; exit 1; }
source "$CONFIG_FILE"

if [[ "$1" != "--force" ]]; then
    log_warn "This will DELETE VM '$VM_NAME' and VCN '${VM_NAME}-vcn'"
    read -p "Continue? [y/N]: " CONFIRM
    [[ ! "$CONFIRM" =~ ^[Yy]$ ]] && { log_info "Aborted"; exit 0; }
fi

# Terminate VM
[[ -n "$INSTANCE_OCID" ]] && {
    log_info "Terminating VM..."
    oci compute instance terminate --instance-id "$INSTANCE_OCID" --preserve-boot-volume false --force 2>/dev/null || true
    sleep 60
}

# Delete VCN
VCN_OCID=$(oci network vcn list --compartment-id "$COMPARTMENT_OCID" --display-name "${VM_NAME}-vcn" --query "data[0].id" --raw-output 2>/dev/null || echo "")
if [[ -n "$VCN_OCID" && "$VCN_OCID" != "null" ]]; then
    log_info "Deleting VCN..."

    for SUBNET_ID in $(oci network subnet list --compartment-id "$COMPARTMENT_OCID" --vcn-id "$VCN_OCID" --query "data[].id" --raw-output 2>/dev/null); do
        [[ -n "$SUBNET_ID" && "$SUBNET_ID" != "null" ]] && oci network subnet delete --subnet-id "$SUBNET_ID" --force 2>/dev/null || true
    done
    sleep 10

    IG_OCID=$(oci network internet-gateway list --compartment-id "$COMPARTMENT_OCID" --vcn-id "$VCN_OCID" --query "data[0].id" --raw-output 2>/dev/null || echo "")
    [[ -n "$IG_OCID" && "$IG_OCID" != "null" ]] && oci network internet-gateway delete --ig-id "$IG_OCID" --force 2>/dev/null || true
    sleep 5

    oci network vcn delete --vcn-id "$VCN_OCID" --force 2>/dev/null || true
fi

log_info "Teardown complete"
