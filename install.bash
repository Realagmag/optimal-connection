#!/bin/bash

set -e  # Exit on error

# Install Django dependencies
echo "Installing Django dependencies..."
cd backend/pop
pip install -r requirements.txt

# Apply Django migrations
echo "Applying Django migrations..."
python3 manage.py migrate

# Load initial data
echo "Loading initial data..."
echo "from optimal_path.load_data import load_all; load_all(); exit()" | python manage.py shell

# Ensure Node.js and npm are installed
echo "Checking for Node.js and npm..."
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null
then
    echo "Node.js and npm not found. Installing..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install React dependencies
echo "Installing React dependencies..."
cd ../../frontend
npm install
