#!/bin/bash

# Change to the directory where your Flask app is located
cd /home/dom/ILP/ILP/flask-framework/

# Activate the virtual environment (if you're using one)
source env/bin/activate

# Start Gunicorn for HTTP (port 80)
sudo /home/dom/portfolio/site/env/bin/gunicorn --bind 0.0.0.0:80 main:app