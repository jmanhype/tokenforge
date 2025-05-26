#!/bin/bash

# Test Runner Script for TokenForge
# This script runs all test suites with proper setup

set -e

echo "🧪 TokenForge Test Suite Runner"
echo "==============================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run tests with status
run_test() {
  local test_name=$1
  local test_command=$2
  
  echo -e "\n${YELLOW}Running ${test_name}...${NC}"
  
  if eval "$test_command"; then
    echo -e "${GREEN}✓ ${test_name} passed${NC}"
    return 0
  else
    echo -e "${RED}✗ ${test_name} failed${NC}"
    return 1
  fi
}

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm ci
fi

# Compile contracts if needed
if [ ! -d "artifacts" ] || [ "$1" == "--compile" ]; then
  echo "Compiling smart contracts..."
  npm run compile
fi

# Track failures
FAILED_TESTS=()

# Run test suites
echo -e "\n📋 Running Test Suites...\n"

# 1. Unit Tests
if ! run_test "Unit Tests" "npm run test:run"; then
  FAILED_TESTS+=("Unit Tests")
fi

# 2. Smart Contract Tests
if ! run_test "Smart Contract Tests" "npm run test:contracts"; then
  FAILED_TESTS+=("Smart Contract Tests")
fi

# 3. Integration Tests (skip if no Convex connection)
if [ -n "$CONVEX_URL" ] || [ -f ".env.local" ]; then
  if ! run_test "Integration Tests" "npm run test:integration"; then
    FAILED_TESTS+=("Integration Tests")
  fi
else
  echo -e "${YELLOW}⚠ Skipping Integration Tests (no Convex configuration)${NC}"
fi

# 4. Linting and Type Checking
if ! run_test "Linting" "npm run lint"; then
  FAILED_TESTS+=("Linting")
fi

# Summary
echo -e "\n==============================="
echo "📊 Test Summary"
echo "==============================="

if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
  
  # Run coverage if all tests pass and --coverage flag is set
  if [ "$1" == "--coverage" ]; then
    echo -e "\n${YELLOW}Generating coverage report...${NC}"
    npm run test:coverage
    echo -e "${GREEN}Coverage report generated in ./coverage${NC}"
  fi
  
  exit 0
else
  echo -e "${RED}❌ Failed tests:${NC}"
  for test in "${FAILED_TESTS[@]}"; do
    echo -e "${RED}  - $test${NC}"
  done
  exit 1
fi