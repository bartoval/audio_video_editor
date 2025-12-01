#!/bin/bash
# Create Oracle Cloud Free Tier VM (Ampere A1). Usage: ./setup-vm.sh [--config]
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/vm-config.env"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $1"; }

check_prerequisites() {
    log_step "Checking prerequisites..."
    command -v oci &>/dev/null || { log_error "OCI CLI not found"; exit 1; }
    oci iam region list &>/dev/null || { log_error "OCI CLI not configured"; exit 1; }

    if [[ ! -f "$HOME/.ssh/id_rsa.pub" ]] && [[ ! -f "$HOME/.ssh/id_ed25519.pub" ]]; then
        log_warn "No SSH key found, creating..."
        ssh-keygen -t ed25519 -f "$HOME/.ssh/id_ed25519" -N ""
    fi
    log_info "Prerequisites OK"
}

load_config() {
    if [[ "$1" == "--config" ]] && [[ -f "$CONFIG_FILE" ]]; then
        source "$CONFIG_FILE"
        return
    fi

    log_step "Configuration"
    DEFAULT_COMPARTMENT=$(grep "^tenancy=" ~/.oci/config | head -1 | cut -d'=' -f2)

    read -p "Compartment OCID [$DEFAULT_COMPARTMENT]: " COMPARTMENT_OCID
    COMPARTMENT_OCID=${COMPARTMENT_OCID:-$DEFAULT_COMPARTMENT}

    read -p "VM Name [studio-server]: " VM_NAME; VM_NAME=${VM_NAME:-studio-server}
    read -p "Region [eu-frankfurt-1]: " REGION; REGION=${REGION:-eu-frankfurt-1}
    read -p "OCPUs [4]: " OCPUS; OCPUS=${OCPUS:-4}
    read -p "Memory GB [24]: " MEMORY_GB; MEMORY_GB=${MEMORY_GB:-24}
    read -p "Boot Volume GB [50]: " BOOT_VOLUME_GB; BOOT_VOLUME_GB=${BOOT_VOLUME_GB:-50}

    DEFAULT_SSH_KEY="$HOME/.ssh/id_ed25519.pub"
    [[ ! -f "$DEFAULT_SSH_KEY" ]] && DEFAULT_SSH_KEY="$HOME/.ssh/id_rsa.pub"
    read -p "SSH Public Key [$DEFAULT_SSH_KEY]: " SSH_KEY_FILE
    SSH_KEY_FILE=${SSH_KEY_FILE:-$DEFAULT_SSH_KEY}

    read -p "Save config? [Y/n]: " SAVE
    [[ ! "$SAVE" =~ ^[Nn]$ ]] && cat > "$CONFIG_FILE" << EOF
COMPARTMENT_OCID="$COMPARTMENT_OCID"
VM_NAME="$VM_NAME"
REGION="$REGION"
OCPUS="$OCPUS"
MEMORY_GB="$MEMORY_GB"
BOOT_VOLUME_GB="$BOOT_VOLUME_GB"
SSH_KEY_FILE="$SSH_KEY_FILE"
EOF
}

create_vcn() {
    log_step "Creating VCN..."
    VCN_NAME="${VM_NAME}-vcn"

    VCN_OCID=$(oci network vcn list --compartment-id "$COMPARTMENT_OCID" --display-name "$VCN_NAME" --query "data[0].id" --raw-output 2>/dev/null || echo "")

    if [[ -z "$VCN_OCID" || "$VCN_OCID" == "null" ]]; then
        VCN_OCID=$(oci network vcn create --compartment-id "$COMPARTMENT_OCID" --display-name "$VCN_NAME" --cidr-blocks '["10.0.0.0/16"]' --query "data.id" --raw-output)
        log_info "Created VCN"
    fi

    # Internet Gateway
    IG_OCID=$(oci network internet-gateway list --compartment-id "$COMPARTMENT_OCID" --vcn-id "$VCN_OCID" --display-name "${VM_NAME}-ig" --query "data[0].id" --raw-output 2>/dev/null || echo "")
    if [[ -z "$IG_OCID" || "$IG_OCID" == "null" ]]; then
        IG_OCID=$(oci network internet-gateway create --compartment-id "$COMPARTMENT_OCID" --vcn-id "$VCN_OCID" --display-name "${VM_NAME}-ig" --is-enabled true --query "data.id" --raw-output)
    fi

    # Route Table
    RT_OCID=$(oci network route-table list --compartment-id "$COMPARTMENT_OCID" --vcn-id "$VCN_OCID" --query "data[0].id" --raw-output)
    oci network route-table update --rt-id "$RT_OCID" --route-rules "[{\"destination\":\"0.0.0.0/0\",\"networkEntityId\":\"$IG_OCID\"}]" --force &>/dev/null || true

    # Security List (SSH, HTTP, HTTPS, 8080)
    SL_OCID=$(oci network security-list list --compartment-id "$COMPARTMENT_OCID" --vcn-id "$VCN_OCID" --query "data[0].id" --raw-output)
    oci network security-list update --security-list-id "$SL_OCID" \
        --ingress-security-rules '[{"source":"0.0.0.0/0","protocol":"6","tcpOptions":{"destinationPortRange":{"min":22,"max":22}}},{"source":"0.0.0.0/0","protocol":"6","tcpOptions":{"destinationPortRange":{"min":80,"max":80}}},{"source":"0.0.0.0/0","protocol":"6","tcpOptions":{"destinationPortRange":{"min":443,"max":443}}},{"source":"0.0.0.0/0","protocol":"6","tcpOptions":{"destinationPortRange":{"min":8080,"max":8080}}}]' \
        --egress-security-rules '[{"destination":"0.0.0.0/0","protocol":"all"}]' --force &>/dev/null

    # Subnet
    SUBNET_OCID=$(oci network subnet list --compartment-id "$COMPARTMENT_OCID" --vcn-id "$VCN_OCID" --display-name "${VM_NAME}-subnet" --query "data[0].id" --raw-output 2>/dev/null || echo "")
    if [[ -z "$SUBNET_OCID" || "$SUBNET_OCID" == "null" ]]; then
        SUBNET_OCID=$(oci network subnet create --compartment-id "$COMPARTMENT_OCID" --vcn-id "$VCN_OCID" --display-name "${VM_NAME}-subnet" --cidr-block "10.0.0.0/24" --query "data.id" --raw-output)
    fi
    log_info "VCN configured"
}

create_vm() {
    log_step "Creating VM..."

    INSTANCE_OCID=$(oci compute instance list --compartment-id "$COMPARTMENT_OCID" --display-name "$VM_NAME" --lifecycle-state RUNNING --query "data[0].id" --raw-output 2>/dev/null || echo "")
    if [[ -n "$INSTANCE_OCID" && "$INSTANCE_OCID" != "null" ]]; then
        log_warn "VM exists: $INSTANCE_OCID"
        get_vm_ip
        return
    fi

    AD=$(oci iam availability-domain list --compartment-id "$COMPARTMENT_OCID" --query "data[0].name" --raw-output)
    IMAGE_OCID=$(oci compute image list --compartment-id "$COMPARTMENT_OCID" --operating-system "Oracle Linux" --operating-system-version "8" --shape "VM.Standard.A1.Flex" --sort-by TIMECREATED --sort-order DESC --query "data[0].id" --raw-output)
    SSH_KEY=$(cat "$SSH_KEY_FILE")

    CLOUD_INIT=$(base64 -w 0 << 'EOF'
#!/bin/bash
dnf install -y dnf-utils
dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin git curl htop
systemctl enable docker && systemctl start docker
usermod -aG docker opc
firewall-cmd --permanent --add-port=80/tcp --add-port=443/tcp --add-port=8080/tcp && firewall-cmd --reload
mkdir -p /opt/studio && chown opc:opc /opt/studio
EOF
)

    log_info "Creating VM.Standard.A1.Flex ($OCPUS OCPUs, ${MEMORY_GB}GB)..."
    INSTANCE_OCID=$(oci compute instance launch \
        --compartment-id "$COMPARTMENT_OCID" --availability-domain "$AD" --display-name "$VM_NAME" \
        --shape "VM.Standard.A1.Flex" --shape-config "{\"ocpus\":$OCPUS,\"memoryInGBs\":$MEMORY_GB}" \
        --image-id "$IMAGE_OCID" --subnet-id "$SUBNET_OCID" --assign-public-ip true \
        --boot-volume-size-in-gbs "$BOOT_VOLUME_GB" \
        --metadata "{\"ssh_authorized_keys\":\"$SSH_KEY\",\"user_data\":\"$CLOUD_INIT\"}" \
        --query "data.id" --raw-output)

    log_info "Waiting for VM..."
    oci compute instance get --instance-id "$INSTANCE_OCID" --wait-for-state RUNNING --wait-interval-seconds 10 &>/dev/null
    get_vm_ip
}

get_vm_ip() {
    VNIC_ID=$(oci compute vnic-attachment list --compartment-id "$COMPARTMENT_OCID" --instance-id "$INSTANCE_OCID" --query "data[0].\"vnic-id\"" --raw-output)
    PUBLIC_IP=$(oci network vnic get --vnic-id "$VNIC_ID" --query "data.\"public-ip\"" --raw-output)
    log_info "Public IP: $PUBLIC_IP"
    echo -e "INSTANCE_OCID=\"$INSTANCE_OCID\"\nPUBLIC_IP=\"$PUBLIC_IP\"" >> "$CONFIG_FILE"
}

deploy_app() {
    log_step "Deploying app..."
    log_info "Waiting for cloud-init (2 min)..."
    sleep 120

    for i in {1..10}; do
        ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 "opc@$PUBLIC_IP" "echo ok" &>/dev/null && break
        log_info "Waiting for SSH... ($i/10)"
        sleep 15
    done

    scp -o StrictHostKeyChecking=no "$SCRIPT_DIR/docker-compose.yml" "$SCRIPT_DIR/nginx.conf" "opc@$PUBLIC_IP:/opt/studio/"

    ssh -o StrictHostKeyChecking=no "opc@$PUBLIC_IP" << 'REMOTE'
mkdir -p /opt/studio/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /opt/studio/certs/privkey.pem -out /opt/studio/certs/fullchain.pem -subj "/CN=localhost" 2>/dev/null
cd /opt/studio && docker compose pull && docker compose up -d
REMOTE
    log_info "Deployed"
}

main() {
    echo -e "\n=== Oracle Cloud VM Setup (Ampere A1 Free Tier) ===\n"
    check_prerequisites
    load_config "$1"
    create_vcn
    create_vm
    deploy_app

    echo -e "\n=== Done! ===\nIP: $PUBLIC_IP\nSSH: ssh opc@$PUBLIC_IP\nWeb: http://$PUBLIC_IP\n"
}

main "$@"
