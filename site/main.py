import asyncio
import base64
import cv2
import hashlib
import json
import numpy as np
import os
import time
from queue import Queue
from threading import Thread

import aiohttp
from aiortc import RTCConfiguration, RTCIceServer, RTCPeerConnection, RTCSessionDescription, VideoStreamTrack
from aiortc.contrib.media import MediaBlackhole, MediaPlayer, MediaRecorder
from flask import Flask, render_template, request, redirect, url_for, flash, make_response, session, jsonify, Response
from flask_login import LoginManager, login_user, login_required, current_user, logout_user
from flask_socketio import SocketIO, emit, join_room
from flask_sqlalchemy import SQLAlchemy
from gevent import monkey
monkey.patch_all()
import logging
from openai import OpenAI
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename
from aiohttp.web import Application, Response, RouteTableDef
from aiohttp import web
from camera import Camera
from flask_cors import CORS

app = Flask(__name__)
app.secret_key = 'some_secret'
CORS(app, resources={r"/*": {"origins": "*"}})
app.config['DEBUG'] = True

logging.basicConfig(level=logging.INFO)

with open('config.json') as json_file:
    config_data = json.load(json_file)
    admin_password = config_data['Credentials']['admin_password']
    app.config['ADMIN_PASSWORD'] = admin_password
    openai = OpenAI(api_key=config_data['Credentials']['openai_key'])

login_manager = LoginManager()
login_manager.init_app(app)

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

def generate_etag(data):
    return hashlib.md5(data).hexdigest()

def add_etag(response):
    response.headers['ETag'] = generate_etag(response.get_data())
    return response

def response_template(template, **kwargs):
    response = make_response(render_template(template, **kwargs))
    response.headers['Cache-Control'] = 'public, max-age=3600'
    response = add_etag(response)
    
    return response

class PortfolioItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(80), nullable=False)
    image = db.Column(db.String(120), nullable=False)
    description = db.Column(db.String(120), nullable=False)
    full_description = db.Column(db.String(120), nullable=False)
    link = db.Column(db.String(120), nullable=False)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(120), nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)
    is_admin = db.Column(db.Boolean, nullable=False)
    is_active = db.Column(db.Boolean, default=True)  # Add this line

    @property
    def is_authenticated(self):
        return self.is_active

    def __repr__(self):
        return '<User %r>' % self.username

    def get_id(self):
        return str(self.id)

@app.route('/chat')
def chat():
    if 'chat_history' not in session:
        session['chat_history'] = [{'role': 'system', 'content': 'You are PineBot, a helpful chat ai used for anything.'}]

    return render_template('chat.html', chat_history=session['chat_history'])

socketio = SocketIO(app, cors_allowed_origins='*', async_mode='gevent')

@app.route('/security_feed')
#@login_required
def security_feed():
    return render_template('security_feed.html')

@app.route('/camera')
def camera_feed():
    return render_template('camera.html')

@socketio.on('connect')
def on_connect():
    print("Client connected: ", request.sid)
    join_room('video_room')
    if '/camera' in request.namespace:
        session['camera_sid'] = request.sid

@socketio.on('disconnect')
def on_disconnect():
    print('Client disconnected: ', request.sid)

@socketio.on('offer')
def handle_offer(payload):
    emit('offer', payload, room='video_room')

@socketio.on('answer')
def handle_answer(payload):
    emit('answer', payload, room='video_room')

@socketio.on('new-ice-candidate')
def handle_new_ice_candidate(payload):
    if 'camera_sid' not in session:
        print("Error: 'camera_sid' not set in session")
        return
    emit('new-ice-candidate', payload, room='video_room')

@app.route('/get_response', methods=['POST'])
def get_response():
    message = request.form['message']
    session['chat_history'].append({'role': 'user', 'content': message})
    session.modified = True  # Add this line

    # Pass the entire chat history to the model for context
    response = openai.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=session['chat_history']
    )

    assistant_message = response.choices[0].message.content
    session['chat_history'].append({'role': 'assistant', 'content': assistant_message})
    return assistant_message

@app.route('/clear_chat', methods=['POST'])
def clear_chat():
    session['chat_history'] = [{'role': 'system', 'content': 'You are PineBot, a helpful chat ai used for anything.'}]
    session.modified = True
    return redirect(url_for('chat'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        user = User.query.filter_by(username=request.form['username']).first()
        if user and check_password_hash(user.password_hash, request.form['password']):
            login_user(user)
            flash('Logged in successfully.', 'success')
            return redirect(url_for('index'))
        else:
            flash('Invalid username or password.', 'error')
            return redirect(url_for('login'))
    else:
        return response_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Logged out successfully.', 'success')
    return redirect(url_for('index'))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        # Check if admin password is correct
        admin_pass = app.config.get('ADMIN_PASSWORD')
        print(admin_pass)
        print(type(request.form['admin_pass']))
        print(type(admin_pass))
        if str(request.form['admin_pass']) != str(admin_pass):
            flash('Incorrect admin password.', 'error')
            return redirect(url_for('register'))

        # Check if username already exists
        existing_user = User.query.filter_by(username=request.form['username']).first()
        if existing_user:
            flash('A user with the same username already exists.', 'error')
            return redirect(url_for('register'))

        user = User(
            username=request.form['username'],
            password_hash=generate_password_hash(request.form['password']),
            is_admin=request.form.get('is_admin') == 'on',
            is_active=True  # Add this line
        )
        db.session.add(user)
        db.session.commit()
        flash('User successfully registered.', 'success')
        return redirect(url_for('login'))
    else:
        return response_template('register.html')

@app.route('/')
def index():
    return response_template('index.html')

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
                    with open('log.txt', 'a') as log:
                        log.write(filename + '\n')
                        if filename == '':
                            log.write('filename is empty\n')

            else:
                filename = ''

        # Check if title already exists
        existing_item = PortfolioItem.query.filter_by(title=request.form['title']).first()
        if existing_item and (edit_item is None or existing_item.id != edit_item.id):
            flash('A portfolio item with the same title already exists.', 'error')
            return redirect(url_for('portfolio'))

        item = PortfolioItem(
            title=request.form['title'],
            image=filename,
            description=request.form['description'],
            full_description=request.form['full_description'],
            link=request.form['link']
        )
        db.session.add(item)
        db.session.commit()
        flash('Portfolio item successfully added.', 'success')
        return redirect(url_for('portfolio'))
    else:
        portfolio_items = PortfolioItem.query.all()
        return response_template('portfolio.html', portfolio_items=portfolio_items, edit_item=edit_item, current_user=current_user)

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
        if 'link' in request.form:
            item.link = request.form['link']
        db.session.commit()
        flash('Portfolio item successfully edited.', 'success')
        return redirect(url_for('portfolio'))
    else:
        return redirect(url_for('portfolio', edit_id=id))

@app.route('/portfolio/delete/<int:id>', methods=['POST'])
def delete_portfolio_item(id):
    item = db.session.get(PortfolioItem, id)
    db.session.delete(item)
    db.session.commit()
    flash('Portfolio item successfully deleted.', 'success')
    return redirect(url_for('portfolio'))

if __name__ == '__main__':
    with app.app_context():
            db.create_all()
    app.run(debug=True)
    socketio.run(app)
    web.run_app(aiohttp_app)
