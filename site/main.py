# main.py
import os
from flask import Flask, render_template, request, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.secret_key = 'some_secret'

# Check if data directory exists, if not create it
data_directory = os.path.join(app.root_path, 'data')
if not os.path.exists(data_directory):
    os.makedirs(data_directory)

database_path = os.path.join(os.path.abspath(os.curdir), 'data', 'database.db')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + database_path
app.config['UPLOAD_FOLDER'] = 'static/images'


# Create upload folder if it doesn't already exist
upload_folder = os.path.join(app.root_path, app.config['UPLOAD_FOLDER'])
if not os.path.exists(upload_folder):
    os.makedirs(upload_folder)

db = SQLAlchemy(app)

class PortfolioItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(80), nullable=False)
    image = db.Column(db.String(120), nullable=False)
    description = db.Column(db.String(120), nullable=False)
    full_description = db.Column(db.String(120), nullable=False)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/portfolio', methods=['GET', 'POST'])
def portfolio():
    edit_item = None
    if 'edit_id' in request.args:
        edit_item = item = db.session.get(PortfolioItem,request.args.get('edit_id'))
    if request.method == 'POST':
        filename = ''
        if 'image' in request.files:
            file = request.files['image']
            if file.filename != '':
                if file and allowed_file(file.filename):
                    filename = secure_filename(file.filename)
                    filename = get_unique_filename(filename)
                    file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                    
                    filename = app.config['UPLOAD_FOLDER'].replace('static/', '') + '/' + filename

        item = PortfolioItem(
            title=request.form['title'],
            image=filename,
            description=request.form['description'],
            full_description=request.form['full_description']
        )
        db.session.add(item)
        db.session.commit()
        return redirect(url_for('portfolio'))
    else:
        portfolio_items = PortfolioItem.query.all()
        return render_template('portfolio.html', portfolio_items=portfolio_items, edit_item=edit_item)

def allowed_file(filename):
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'svg'}
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_unique_filename(filename):
    counter = 1
    filename, extension = os.path.splitext(filename)
    while os.path.isfile(os.path.join(app.config['UPLOAD_FOLDER'], filename + extension)):
        filename = f"{filename}({counter})"
        counter += 1
    return filename + extension

@app.route('/portfolio/edit/<int:id>', methods=['GET', 'POST'])
def edit_portfolio_item(id):
    item = db.session.get(PortfolioItem, id)
    if request.method == 'POST':
        if 'title' in request.form:
            item.title = request.form['title']
        if 'image' in request.files:
            file = request.files['image']
            if file.filename != '':
                if file and allowed_file(file.filename):
                    filename = secure_filename(file.filename)
                    file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                    filename = app.config['UPLOAD_FOLDER'].replace('static/', '') + '/' + filename
                    item.image = filename
        if 'description' in request.form:
            item.description = request.form['description']
        if 'full_description' in request.form:
            item.full_description = request.form['full_description']
        db.session.commit()
        return redirect(url_for('portfolio'))
    else:
        return redirect(url_for('portfolio', edit_id=id))

@app.route('/portfolio/delete/<int:id>', methods=['POST'])
def delete_portfolio_item(id):
    item = db.session.get(PortfolioItem, id)
    db.session.delete(item)
    db.session.commit()
    return redirect(url_for('portfolio'))

if __name__ == '__main__':
    with app.app_context():
            db.create_all()
    app.run(debug=True)