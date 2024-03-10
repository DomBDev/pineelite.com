import asyncio
import base64
import hashlib
import json
import numpy as np
import os
import time
from queue import Queue
from threading import Thread
from markdown import markdown

import aiohttp
from aiortc import RTCConfiguration, RTCIceServer, RTCPeerConnection, RTCSessionDescription, VideoStreamTrack
from aiortc.contrib.media import MediaBlackhole, MediaPlayer, MediaRecorder
from flask import Flask, render_template, request, redirect, url_for, flash, make_response, session, jsonify, Response
from flask_login import LoginManager, login_user, login_required, current_user, logout_user
from flask_socketio import SocketIO, emit
from flask_sqlalchemy import SQLAlchemy
import logging
from openai import OpenAI
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename
from aiohttp.web import Application, Response, RouteTableDef
from aiohttp import web
from flask_cors import CORS
import autogen
import sqlite3

app = Flask(__name__)
app.secret_key = 'some_secret'
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
    if 'chat_mode' not in session:
        session['chat_mode'] = 'simple'
    return render_template('chat.html', chat_history=session['chat_history'], mode=session['chat_mode'])

@app.route('/simple_response', methods=['POST'])
def simple_response():
    message = request.form['message']
    session['chat_history'].append({'role': 'user', 'content': message})
    session.modified = True 

    # Pass the entire chat history to the model for context
    try:
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=session['chat_history']
        )
    except Exception as e:
        print(e)
        return str(e)

    assistant_message = markdown(response.choices[0].message.content, extensions=[
        'extra',
        ])
    session['chat_history'].append({'role': 'assistant', 'content': assistant_message})
    session['chat_mode'] = 'simple'
    session.modified = True
    return assistant_message


### Autogen Response (NOT APPLICABLE YET) ###
"""
config_list = autogen.config_list_from_json(
    "OAI_CONFIG_LIST",
    filter_dict={
        "model": ["gpt-3.5-turbo"],
    },
)

# Initialize AutoGen agents and chat settings
llm_config = {"config_list": config_list, "cache_seed": 42}
user_proxy = autogen.UserProxyAgent(
    name="User_proxy",
    system_message="A human admin.",
    code_execution_config=False,
    human_input_mode="TERMINATE",
    llm_config=llm_config,
)

user_proxy.max_consecutive_auto_reply(1)


writer = autogen.AssistantAgent( 
    name="Writer", 
    system_message="Flesh out the existing output, as well as developing and progressing pre-existing information (whether that be code or language). Be sure to also forward the pre-existing and updated information to the other agents.",
    llm_config=llm_config, )

editor = autogen.AssistantAgent( 
    name="Editor", 
    system_message="Finalize the output from the Writer, as well as finalizing pre-existing and updated information (whether that be code or language). Be sure to also forward the pre-existing and updated information to the other agents.",
    llm_config=llm_config, )
groupchat = autogen.GroupChat(agents=[user_proxy, writer, editor], messages=[], max_round=12)
manager = autogen.GroupChatManager(groupchat=groupchat, llm_config=llm_config)
"""
"""
    # Pass user message to AutoGen UserProxyAgent
    user_proxy.initiate_chat(manager, message=message)
    
    # Get the message history of the AutoGen GroupChat
    chat_history = manager.groupchat.messages
    try:
        summary = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=chat_history + [{"role": "system", "content": f"Your job is to extract all the important information from this entire conversation between AI agents. Do not explain it as a conversation, finalize the document, whether that be code or a paper or whatever, finalize it. The object of this conversation is to result in a specific task being accomplished, extract the information that completes this task and finish it off and format it with markdown. Don't forward 'tasks' as those are meant to be completed by the AI. Extract all the important information regarding the initial task: {message}"}],
        )
    except Exception as e:
        print(e)
        return str(e)

    assistant_message = markdown(summary.choices[0].message.content, extensions=[
        'extra',
        ])
    session['chat_history'].append({'role': 'assistant', 'content': assistant_message})
"""

retry_count = 0
def generate_task_list(outline, message):
    global retry_count
    if retry_count <= 3:
        try: 
            task_list = eval(openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=session['chat_history']+[{"role":"system", "content":f"Break down the outline into chunks, Each chunk should be a single prompt given to an AI to complete one sequential step, and should accomplish a portion of the task, and should be accomplishable in one prompt. Overall each chunk/prompt should progress towards the overall task or goal. Output ONLY a python list, giving a prompt for each chunk (EXAMPLE: ['insert_chunk_one_prompt', 'insert_chunk_two_prompt']) Make each prompt as long as possible. The max number of tasks should be 8, so combine then if needed (specify sub-tasks to complete within one prompt). For each task/prompt, make sure to explain to the AI agent how to respond and how long to make its response to fit the guidlines specified by the overall goal. Each item on the outline will be executed sequentially and the output of each chunk will be appended to the final output, so plan for this. If the chunks/tasks are too similar, they will be skipped, so if they're similar specify differences between them. The sub task/step you're assigned is '{message}'"}]
            ).choices[0].message.content)
        except Exception as e:
            print(e)
            retry_count += 1
            task_list = generate_task_list(outline, message)
        else:
            retry_count = 0
    else:
        task_list = "I'm sorry, I can't complete this task at the moment. Please try again later."
    
    return task_list

@app.route('/complex_response', methods=['POST'])
def complex_response():
    message = request.form['message']

    session['chat_history'].append({'role': 'user', 'content': message})
    session.modified = True

    # Pass the entire chat history to the model for context
    task = None
    output = ""
    try:
        outline = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=session['chat_history']+[{"role":"system", "content":f"Create an outline for completing the task. Each item on the outline will be executed sequentially, so plan for this. The initial task is '{message}'"}]
            )
        print(f"Outline Created")

        task_list = generate_task_list(outline.choices[0].message.content, message)
        if task_list == "I'm sorry, I can't complete this task at the moment. Please try again later.":
            raise Exception("I'm sorry, I can't complete this task at the moment. Please try again later.")

        print(f"Task List: {task_list}")
        previous_task = "No Task"
        count = 0
        for task in task_list:
            if count >= 7:
                break
            count += 1
            new_task = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=session['chat_history']+[{"role":"system", "content":f"You're supposed to complete the tasks assigned to you. Keep in mind your output is appended directly to the output from the last task, so don't include any information before or after your 'chunk' to contribute towards the task. The output so far is {output} (Don't include anything from the output completion so far, but this is what comes right before what you're appending to the output, so don't include duplicate information. The initial goal is: '{message}'. Complete the sub-task: '{task}'"}]
                )

            new_task = new_task.choices[0].message.content

            decision = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role":"system", "content":f"Decide whether to include the output from the last task in the final output. The output from all the previous tasks combined into one continuous output: {output}. The output from the current task is: {new_task}. Respond with only 'yes' or 'no'. Respond 'yes' if it should be appended to the output, or 'no' if it should be removed"}]
                )
            decision = decision.choices[0].message.content.lower().strip()
            if decision == "yes":
                output += f"\n\n{new_task}"
                print(f"Output Completed: {task}")
            else:
                print(f"Output Skipped: {task}")
            previous_task = task

        output = output.strip()
        output = markdown(output, extensions=[
            'extra',
            ])

    except Exception as e:
        print(e)
        return str(e)

    session['chat_history'].append({'role': 'assistant', 'content': output})
    session['chat_mode'] = 'complex'

    return output



@app.route('/clear_chat', methods=['POST'])
def clear_chat():
    session['chat_history'] = [{'role': 'system', 'content': 'You are PineBot, a helpful chat ai used for anything.'}]
    session.modified = True
    return redirect(url_for('chat'))

@app.route('/game', methods=['GET', 'POST'])
def game():
    return render_template('game.html')

socketio = socketio = SocketIO(app, max_decode_packets=1000, max_http_buffer_size=1000000, async_mode='eventlet')#  engineio_logger=True,
socketio.init_app(app, cors_allowed_origins="*")
players = []
session_player_map = {}

@socketio.on('connect', namespace='/game')
def handle_connect():
    print('Client connected')

@socketio.on('disconnect', namespace='/game')
def handle_disconnect():
    print('Client disconnected')
    try:
        player_id = session_player_map[request.sid]
        players.remove(player_id)
        session_player_map.pop(request.sid)
        emit('players', players, broadcast=True)
    except Exception as e:
        print(e)

@socketio.on('join', namespace='/game')
def handle_join(player_id):
    # Handle PeerJS connection
    print(f'Player {player_id} joined')

    # Add the new player to the list of players
    players.append(player_id)

    # Add the player to the session-player map
    session_player_map[request.sid] = player_id

    # Send the new player the current list of players
    print(f'Players: {players}')
    emit('players', players, broadcast=False)

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
    web.run_app(aiohttp_app)
    socketio.run(app, debug=True)
