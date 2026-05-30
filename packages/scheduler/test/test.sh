#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEDULER_DIR="$(dirname "$SCRIPT_DIR")"

BASE_URL="${API_BASE_URL:-http://localhost:3000}"
CLI_ENDPOINT="$BASE_URL/api/v1/cli"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

usage() {
    cat << EOF
MagicSync CLI Test Suite

Usage:
    ./test.sh <command> [options]

Commands:
    ping                    Test API connectivity and authentication
    info                    Get connected platforms and their rules
    validate [json]         Validate content against platform rules
    post [json]             Create and optionally publish/schedule a post
    all                     Run all tests in sequence
    help                    Show this help message

Environment Variables:
    API_BASE_URL            Base URL for the API (default: http://localhost:3000)
    API_TOKEN               Your MagicSync API key (required)
    POST_CONTENT            Content for test post (default: "Test post from CLI")
    SCHEDULE_TIME           ISO date for scheduling (optional)

Examples:
    # Run all tests
    API_TOKEN=your-api-key ./test.sh all

    # Test connectivity
    API_TOKEN=your-api-key ./test.sh ping

    # Get platform info
    API_TOKEN=your-api-key ./test.sh info

    # Validate a post
    API_TOKEN=your-api-key ./test.sh validate

    # Create a post
    API_TOKEN=your-api-key ./test.sh post

    # Custom base URL
    API_BASE_URL=https://api.example.com API_TOKEN=your-key ./test.sh ping

    # With custom content
    POST_CONTENT="My custom post content" API_TOKEN=your-key ./test.sh post

    # Schedule for a specific time (ISO 8601 format)
    SCHEDULE_TIME="2026-06-01T10:00:00Z" API_TOKEN=your-key ./test.sh post

    # Validate with custom payload
    API_TOKEN=your-key ./test.sh validate '{"content": "Test", "platforms": ["twitter"]}'

    # Post with custom JSON payload
    API_TOKEN=your-key ./test.sh post '{"content": "Hello World", "platforms": ["twitter", "bluesky"]}'

EOF
}

check_token() {
    if [ -z "$API_TOKEN" ]; then
        print_error "API_TOKEN environment variable is required"
        echo "Get your API key from the MagicSync dashboard"
        exit 1
    fi
}

get_default_post_body() {
    local content="${POST_CONTENT:-Test post from MagicSync CLI $(date -u +%Y-%m-%dT%H:%M:%SZ)}"
    local scheduled=""

    if [ -n "$SCHEDULE_TIME" ]; then
        scheduled="\"scheduledAt\": \"$SCHEDULE_TIME\","
    fi

    cat << EOF
{
    "content": "$content",
    "platforms": ["twitter"],
    "media": {
        "image": []
    },
    $scheduled
    "commentPrompts": ["What do you think about this?"]
}
EOF
}

get_default_validate_body() {
    local content="${POST_CONTENT:-Test validation from CLI}"
    cat << EOF
{
    "content": "$content",
    "platforms": ["twitter"],
    "media": {
        "image": []
    }
}
EOF
}

cmd_ping() {
    print_header "Testing API Connectivity"

    print_info "Endpoint: $CLI_ENDPOINT/ping"
    print_info "Token: ${API_TOKEN:0:8}..."

    response=$(curl -s -w "\n%{http_code}" \
        -H "X-Api-Key: $API_TOKEN" \
        "$CLI_ENDPOINT/ping")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        print_success "Ping successful (HTTP $http_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        return 0
    else
        print_error "Ping failed (HTTP $http_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        return 1
    fi
}

cmd_info() {
    print_header "Getting Connected Platforms"

    print_info "Endpoint: $CLI_ENDPOINT/info"

    response=$(curl -s -w "\n%{http_code}" \
        -H "X-Api-Key: $API_TOKEN" \
        "$CLI_ENDPOINT/info")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        print_success "Info retrieved (HTTP $http_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        return 0
    else
        print_error "Info request failed (HTTP $http_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        return 1
    fi
}

cmd_validate() {
    print_header "Validating Content"

    local payload="${1:-$(get_default_validate_body)}"

    print_info "Endpoint: $CLI_ENDPOINT/validate"
    echo "$payload" | jq '.' 2>/dev/null || print_warning "Invalid JSON in payload, sending as-is"

    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "X-Api-Key: $API_TOKEN" \
        -d "$payload" \
        "$CLI_ENDPOINT/validate")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        print_success "Validation successful (HTTP $http_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        return 0
    else
        print_error "Validation failed (HTTP $http_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        return 1
    fi
}

cmd_post() {
    print_header "Creating Post"

    local payload="${1:-$(get_default_post_body)}"

    print_info "Endpoint: $CLI_ENDPOINT/post"
    echo "$payload" | jq '.' 2>/dev/null || print_warning "Invalid JSON in payload, sending as-is"

    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "X-Api-Key: $API_TOKEN" \
        -d "$payload" \
        "$CLI_ENDPOINT/post")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        print_success "Post created (HTTP $http_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        return 0
    else
        print_error "Post creation failed (HTTP $http_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        return 1
    fi
}

cmd_all() {
    print_header "Running All CLI Tests"
    print_info "Base URL: $BASE_URL"
    echo ""

    local failures=0

    echo "Running ping test..."
    cmd_ping || ((failures++))

    echo ""
    echo "Running info test..."
    cmd_info || ((failures++))

    echo ""
    echo "Running validate test..."
    cmd_validate || ((failures++))

    echo ""
    echo "Running post test..."
    cmd_post || ((failures++))

    print_header "Test Summary"

    if [ $failures -eq 0 ]; then
        print_success "All tests passed!"
        exit 0
    else
        print_error "$failures test(s) failed"
        exit 1
    fi
}

main() {
    if [ $# -eq 0 ]; then
        usage
        exit 1
    fi

    case "$1" in
        ping)
            check_token
            cmd_ping
            ;;
        info)
            check_token
            cmd_info
            ;;
        validate)
            check_token
            cmd_validate "${2:-}"
            ;;
        post)
            check_token
            cmd_post "${2:-}"
            ;;
        all)
            check_token
            cmd_all
            ;;
        help|--help|-h)
            usage
            ;;
        *)
            print_error "Unknown command: $1"
            usage
            exit 1
            ;;
    esac
}

main "$@"