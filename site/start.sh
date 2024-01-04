#!/bin/bash

# Change to the directory where your Flask app is located
cd /home/dom/portfolio/site

# Activate the virtual environment (if you're using one)
source env/bin/activate

# Start Gunicorn for HTTP (port 80)
sudo /home/dom/portfolio/site/env/bin/gunicorn --bind 0.0.0.0:80 main:app
sudo /home/dom/portfolio/site/env/bin/gunicorn --bind 0.0.0.0:443 main:app --certfile=cert.pem --keyfile=privkey.pem