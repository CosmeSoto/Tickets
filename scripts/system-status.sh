#!/bin/bash

# System Status Check Script
# Sistema de Tickets Next.js

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="tickets-app"
HEALTH_URL="http://localhost:3000/api/health"
ADMIN_HEALTH_URL="http://localhost:3000/api/admin/health"

# Functions
print_header() {
    echo -e "${CYAN}================================${NC}"
    echo -e "${CYAN}  Sistema de Tickets - Status   ${NC}"
    echo -e "${CYAN}================================${NC}"
    echo ""
}

print_section() {
    echo -e "${BLUE}📋 $1${NC}"
    echo "----------------------------------------"
}

check_status() {
    local service="$1"
    local command="$2"
    local expected="$3"
    
    if eval "$command" &>/dev/null; then
        echo -e "✅ ${GREEN}$service: OK${NC}"
        return 0
    else
        echo -e "❌ ${RED}$service: FAILED${NC}"
        return 1
    fi
}

check_url() {
    local name="$1"
    local url="$2"
    local timeout="${3:-5}"
    
    local response=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$timeout" "$url" 2>/dev/null || echo "000")
    
    if [[ "$response" == "200" ]]; then
        echo -e "✅ ${GREEN}$name: OK (HTTP $response)${NC}"
        return 0
    else
        echo -e "❌ ${RED}$name: FAILED (HTTP $response)${NC}"
        return 1
    fi
}

get_service_info() {
    local service="$1"
    local command="$2"
    
    local result=$(eval "$command" 2>/dev/null || echo "N/A")
    echo -e "ℹ️  ${CYAN}$service:${NC} $result"
}

# Main status check
main() {
    print_header
    
    local total_checks=0
    local passed_checks=0
    
    # System Information
    print_section "System Information"
    get_service_info "Hostname" "hostname"
    get_service_info "OS" "uname -s"
    get_service_info "Kernel" "uname -r"
    get_service_info "Architecture" "uname -m"
    get_service_info "Uptime" "uptime -p"
    get_service_info "Load Average" "uptime | awk -F'load average:' '{print \$2}'"
    echo ""
    
    # Resource Usage
    print_section "Resource Usage"
    get_service_info "Memory Usage" "free -h | grep '^Mem:' | awk '{print \$3\"/\"\$2\" (\"int(\$3/\$2*100)\"%)\"}'"
    get_service_info "Disk Usage" "df -h / | tail -1 | awk '{print \$3\"/\"\$2\" (\"int(\$3/\$2*100)\"%)\"}'"
    get_service_info "CPU Usage" "top -bn1 | grep 'Cpu(s)' | awk '{print \$2}' | cut -d'%' -f1"
    echo ""
    
    # Node.js and Dependencies
    print_section "Node.js Environment"
    total_checks=$((total_checks + 1))
    if check_status "Node.js" "command -v node"; then
        passed_checks=$((passed_checks + 1))
        get_service_info "Node.js Version" "node --version"
    fi
    
    total_checks=$((total_checks + 1))
    if check_status "npm" "command -v npm"; then
        passed_checks=$((passed_checks + 1))
        get_service_info "npm Version" "npm --version"
    fi
    
    total_checks=$((total_checks + 1))
    if check_status "PM2" "command -v pm2"; then
        passed_checks=$((passed_checks + 1))
        get_service_info "PM2 Version" "pm2 --version"
    fi
    echo ""
    
    # Application Status
    print_section "Application Status"
    total_checks=$((total_checks + 1))
    if check_status "PM2 Process" "pm2 list | grep -q '$APP_NAME.*online'"; then
        passed_checks=$((passed_checks + 1))
        
        # Get PM2 details
        echo "📊 PM2 Process Details:"
        pm2 list | grep -E "(App name|$APP_NAME)" || echo "No PM2 processes found"
        echo ""
        
        # Memory and CPU usage
        get_service_info "App Memory" "pm2 list | grep '$APP_NAME' | awk '{print \$6}'"
        get_service_info "App CPU" "pm2 list | grep '$APP_NAME' | awk '{print \$7}'"
    fi
    echo ""
    
    # Health Checks
    print_section "Health Checks"
    total_checks=$((total_checks + 1))
    if check_url "Public Health Check" "$HEALTH_URL"; then
        passed_checks=$((passed_checks + 1))
        
        # Get detailed health info
        local health_response=$(curl -s "$HEALTH_URL" 2>/dev/null || echo "{}")
        echo "📊 Health Details:"
        echo "$health_response" | jq '.' 2>/dev/null || echo "$health_response"
    fi
    
    total_checks=$((total_checks + 1))
    if check_url "Admin Health Check" "$ADMIN_HEALTH_URL"; then
        passed_checks=$((passed_checks + 1))
    fi
    echo ""
    
    # Database Status
    print_section "Database Status"
    if [[ -n "$DATABASE_URL" ]]; then
        total_checks=$((total_checks + 1))
        if check_status "Database Connection" "pg_isready -d '$DATABASE_URL'"; then
            passed_checks=$((passed_checks + 1))
            
            # Database info
            local db_info=$(psql "$DATABASE_URL" -t -c "SELECT version();" 2>/dev/null | head -1 | xargs || echo "N/A")
            get_service_info "Database Version" "echo '$db_info'"
            
            # Connection count
            local connections=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | xargs || echo "N/A")
            get_service_info "Active Connections" "echo '$connections'"
        fi
    else
        echo -e "⚠️  ${YELLOW}DATABASE_URL not configured${NC}"
    fi
    echo ""
    
    # Redis Status (if configured)
    print_section "Redis Status"
    if [[ -n "$REDIS_URL" ]]; then
        total_checks=$((total_checks + 1))
        if check_status "Redis Connection" "redis-cli -u '$REDIS_URL' ping | grep -q PONG"; then
            passed_checks=$((passed_checks + 1))
            
            # Redis info
            local redis_info=$(redis-cli -u "$REDIS_URL" info server 2>/dev/null | grep redis_version | cut -d: -f2 | tr -d '\r' || echo "N/A")
            get_service_info "Redis Version" "echo '$redis_info'"
            
            # Memory usage
            local redis_memory=$(redis-cli -u "$REDIS_URL" info memory 2>/dev/null | grep used_memory_human | cut -d: -f2 | tr -d '\r' || echo "N/A")
            get_service_info "Redis Memory" "echo '$redis_memory'"
        fi
    else
        echo -e "⚠️  ${YELLOW}REDIS_URL not configured${NC}"
    fi
    echo ""
    
    # File System Checks
    print_section "File System"
    local app_dir="/var/www/tickets-app"
    if [[ -d "$app_dir" ]]; then
        total_checks=$((total_checks + 1))
        if check_status "Application Directory" "test -d '$app_dir'"; then
            passed_checks=$((passed_checks + 1))
            get_service_info "App Directory Size" "du -sh '$app_dir' | cut -f1"
        fi
        
        total_checks=$((total_checks + 1))
        if check_status "Node Modules" "test -d '$app_dir/node_modules'"; then
            passed_checks=$((passed_checks + 1))
        fi
        
        total_checks=$((total_checks + 1))
        if check_status "Build Directory" "test -d '$app_dir/.next'"; then
            passed_checks=$((passed_checks + 1))
        fi
    fi
    echo ""
    
    # Log Files
    print_section "Log Files"
    local log_dir="/var/log/tickets-app"
    if [[ -d "$log_dir" ]]; then
        get_service_info "Log Directory" "ls -la '$log_dir' | wc -l"
        
        # Recent errors
        local error_count=$(find "$log_dir" -name "*.log" -exec grep -c "ERROR" {} + 2>/dev/null | awk '{sum += $1} END {print sum}' || echo "0")
        get_service_info "Recent Errors" "echo '$error_count'"
        
        # Log file sizes
        if [[ -f "$log_dir/combined.log" ]]; then
            get_service_info "Combined Log Size" "du -sh '$log_dir/combined.log' | cut -f1"
        fi
    else
        echo -e "⚠️  ${YELLOW}Log directory not found${NC}"
    fi
    echo ""
    
    # Network Status
    print_section "Network Status"
    total_checks=$((total_checks + 1))
    if check_status "Port 3000 Listening" "netstat -tlnp | grep -q ':3000'"; then
        passed_checks=$((passed_checks + 1))
        
        # Show process using port 3000
        local port_process=$(netstat -tlnp 2>/dev/null | grep ':3000' | awk '{print $7}' | head -1 || echo "N/A")
        get_service_info "Port 3000 Process" "echo '$port_process'"
    fi
    
    # External connectivity
    total_checks=$((total_checks + 1))
    if check_status "Internet Connectivity" "ping -c 1 8.8.8.8"; then
        passed_checks=$((passed_checks + 1))
    fi
    echo ""
    
    # Security Checks
    print_section "Security Status"
    
    # Check for security updates
    if command -v apt &>/dev/null; then
        local security_updates=$(apt list --upgradable 2>/dev/null | grep -c security || echo "0")
        get_service_info "Security Updates Available" "echo '$security_updates'"
    fi
    
    # Check firewall status
    if command -v ufw &>/dev/null; then
        local firewall_status=$(ufw status | head -1 | awk '{print $2}' || echo "N/A")
        get_service_info "Firewall Status" "echo '$firewall_status'"
    fi
    
    # Check SSL certificate (if HTTPS)
    if [[ -n "$NEXTAUTH_URL" && "$NEXTAUTH_URL" == https* ]]; then
        local domain=$(echo "$NEXTAUTH_URL" | sed 's|https://||' | sed 's|/.*||')
        local ssl_expiry=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -dates | grep notAfter | cut -d= -f2 || echo "N/A")
        get_service_info "SSL Certificate Expiry" "echo '$ssl_expiry'"
    fi
    echo ""
    
    # Summary
    print_section "Summary"
    local success_rate=$((passed_checks * 100 / total_checks))
    
    echo -e "📊 ${CYAN}Health Score: $passed_checks/$total_checks ($success_rate%)${NC}"
    
    if [[ $success_rate -ge 90 ]]; then
        echo -e "🎉 ${GREEN}System Status: EXCELLENT${NC}"
    elif [[ $success_rate -ge 75 ]]; then
        echo -e "✅ ${GREEN}System Status: GOOD${NC}"
    elif [[ $success_rate -ge 50 ]]; then
        echo -e "⚠️  ${YELLOW}System Status: WARNING${NC}"
    else
        echo -e "❌ ${RED}System Status: CRITICAL${NC}"
    fi
    
    echo ""
    echo -e "${CYAN}Recommendations:${NC}"
    
    if [[ $success_rate -lt 100 ]]; then
        echo "• Review failed checks above"
        echo "• Check application logs: pm2 logs $APP_NAME"
        echo "• Verify environment configuration"
        echo "• Ensure all services are running"
    else
        echo "• System is running optimally"
        echo "• Continue regular monitoring"
    fi
    
    if [[ $success_rate -lt 75 ]]; then
        echo "• Consider running deployment health check"
        echo "• Review system resources"
        echo "• Check for recent changes or deployments"
    fi
    
    echo ""
    echo -e "${CYAN}Quick Commands:${NC}"
    echo "• View PM2 status: pm2 status"
    echo "• View application logs: pm2 logs $APP_NAME"
    echo "• Restart application: pm2 restart $APP_NAME"
    echo "• View system resources: htop"
    echo "• Check health endpoint: curl $HEALTH_URL"
    
    echo ""
    echo -e "${CYAN}Generated: $(date)${NC}"
    
    # Exit with appropriate code
    if [[ $success_rate -ge 75 ]]; then
        exit 0
    else
        exit 1
    fi
}

# Script usage
usage() {
    echo "Usage: $0 [options]"
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -q, --quiet    Quiet mode (less verbose output)"
    echo "  -j, --json     Output in JSON format"
    echo ""
    echo "Environment variables:"
    echo "  DATABASE_URL   Database connection string"
    echo "  REDIS_URL      Redis connection string"
    echo "  NEXTAUTH_URL   Application URL"
}

# Parse command line arguments
QUIET_MODE=false
JSON_OUTPUT=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            exit 0
            ;;
        -q|--quiet)
            QUIET_MODE=true
            shift
            ;;
        -j|--json)
            JSON_OUTPUT=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Run main function
main "$@"