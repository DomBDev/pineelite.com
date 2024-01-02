# main.py
from flask import Flask, render_template

app = Flask(__name__)

# Placeholder data for demonstration
portfolio_items = [
    {'title': 'Project 1', 'image': 'images/placeholder.jpg', 'description': 'Description for Project 1'},
    {'title': 'Project 2', 'image': 'images/placeholder.jpg', 'description': 'Description for Project 2'},
    # Add more items as needed
]

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/portfolio')
def portfolio():
    return render_template('portfolio.html', portfolio_items=portfolio_items)

if __name__ == '__main__':
    app.run(debug=True)
