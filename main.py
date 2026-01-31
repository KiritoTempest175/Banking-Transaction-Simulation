from flask import Flask, render_template, request, redirect, url_for, flash, Response
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
import json
import os
import hashlib
import uuid
from datetime import datetime, timedelta
import io
import csv

# --- OPTIONAL: PDF GENERATION SUPPORT ---
try:
    from fpdf import FPDF
except ImportError:
    print("WARNING: fpdf module not found. PDF generation will be disabled.")
    FPDF = None

# --- IMPORT MERKLE TREE ---
try:
    from markle_tree import merkleTree
except ImportError:
    print("WARNING: markle_tree.py not found. Please ensure the file exists.")
    class merkleTree:
        def makeTreeFromArray(self, arr): pass
        def calculateMerkleRoot(self): return "ERROR_LIB_MISSING"
        def getMerkleRoot(self): return "ERROR_LIB_MISSING"

app = Flask(__name__)
app.secret_key = 'Key'

# --- SETUP FLASK-LOGIN ---
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# --- HELPER FUNCTIONS ---
def get_json_path(filename):
    # Uses absolute path to ensure PythonAnywhere can find the files
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_dir, 'data', filename)

def init_files():
    """Ensures all JSON files exist on startup."""
    data_dir = os.path.dirname(get_json_path('user.json'))
    os.makedirs(data_dir, exist_ok=True)
    files = {
        'user.json': {"accounts": {}},
        'snapshots.json': [],
        'transaction.json': []
    }
    for filename, default_data in files.items():
        path = get_json_path(filename)
        if not os.path.exists(path):
            with open(path, 'w') as f: json.dump(default_data, f, indent=4)

def load_json(filename):
    path = get_json_path(filename)
    if not os.path.exists(path) or os.stat(path).st_size == 0:
        if filename == 'user.json': return {"accounts": {}}
        return []
    try:
        with open(path, 'r') as f: return json.load(f)
    except Exception:
        if filename == 'user.json': return {"accounts": {}}
        return []

def save_json(filename, data):
    path = get_json_path(filename)
    try:
        with open(path, 'w') as f: json.dump(data, f, indent=4)
    except Exception as e:
        print(f"Error saving {filename}: {e}")

# --- MERKLE HELPER ---
def format_transaction_string(tx_id, sender, receiver, amount, timestamp):
    # Hash ONLY the amount to prevent timestamp mismatch errors during verification
    return str(float(amount))

def get_merkle_root():
    transactions = load_json('transaction.json')
    if not transactions: return "Empty Tree"
    tx_strings = []
    for tx in transactions:
        s = format_transaction_string(tx['id'], tx['sender'], tx['receiver'], tx['final_amount'], tx['timestamp'])
        tx_strings.append(s)
    mt = merkleTree()
    mt.makeTreeFromArray(tx_strings)
    mt.calculateMerkleRoot()
    return mt.getMerkleRoot()

# --- NEW: AUTO-PROCESSOR FOR FAST TRANSACTIONS ---
def process_fast_transactions():
    """
    Checks snapshots.json for 'fast' transactions older than 30 seconds.
    Moves them to transaction.json automatically.
    """
    snapshot = load_json('snapshots.json')
    if not snapshot: return

    user_data = load_json('user.json')
    transactions = load_json('transaction.json')

    # Identify items to process
    updated_snapshot = []
    items_processed = False

    now = datetime.now()

    for tx in snapshot:
        should_process = False

        # Check if mode is fast
        if tx.get('mode') == 'fast':
            try:
                tx_time = datetime.strptime(tx['timestamp'], "%Y-%m-%d %H:%M:%S")
                # Check if 30 seconds have passed
                if (now - tx_time).total_seconds() >= 30:
                    should_process = True
            except ValueError:
                pass # Date error, leave it for admin to fix

        if should_process:
            items_processed = True
            sender_id = str(tx['sender_id']).strip()
            receiver_id = str(tx['receiver_id']).strip()
            amount = float(tx['amount'])

            # Find Account Keys
            sender_key = None
            receiver_key = None

            for key, acc in user_data['accounts'].items():
                acc_id = str(acc.get('account_id', '')).strip()
                if acc_id == sender_id: sender_key = key
                if acc_id == receiver_id: receiver_key = key

            # Execute Transfer
            if sender_key and receiver_key:
                if user_data['accounts'][sender_key]['balance'] >= amount:
                    user_data['accounts'][sender_key]['balance'] -= amount
                    user_data['accounts'][receiver_key]['balance'] += amount

                    # Create Ledger Entry
                    prev_hash = transactions[-1]['hash'] if len(transactions) > 0 else "0"
                    ledger_string = format_transaction_string(tx['id'], sender_id, receiver_id, amount, tx['timestamp']) + prev_hash
                    current_hash = hashlib.sha256(ledger_string.encode()).hexdigest()

                    record = {
                        "id": tx['id'],
                        "sender": sender_id,
                        "receiver": receiver_id,
                        "original_amount": amount,
                        "final_amount": amount,
                        "theft_amount": 0, # No theft on fast auto-approve
                        "mode": "fast",
                        "timestamp": tx['timestamp'],
                        "status": "APPROVED (AUTO)",
                        "approver": "SYSTEM",
                        "previous_hash": prev_hash,
                        "hash": current_hash,
                        "integrity_hash": tx.get('integrity_hash', 'N/A')
                    }
                    transactions.append(record)
                else:
                    # Insufficient funds (Auto Reject)
                    pass
            else:
                # Account error (Auto Reject)
                pass
        else:
            # Keep in snapshot (either standard mode or not 30s yet)
            updated_snapshot.append(tx)

    if items_processed:
        save_json('user.json', user_data)
        save_json('transaction.json', transactions)
        save_json('snapshots.json', updated_snapshot)

# --- USER CLASS (Restored All Limits) ---
class User(UserMixin):
    def __init__(self, id, username, role, blocked, balance, email, phone, address, daily_limit, last_login, atm_limit, intl_limit, pos_limit):
        self.id = str(id).strip()
        self.username = username
        self.role = role
        self.blocked = blocked
        self.balance = balance
        self.email = email
        self.phone = phone
        self.address = address
        self.daily_limit = daily_limit
        self.last_login = last_login
        # Extra Limits
        self.atm_limit = atm_limit
        self.intl_limit = intl_limit
        self.pos_limit = pos_limit

    @property
    def is_active(self): return not self.blocked

@login_manager.user_loader
def load_user(user_id):
    try:
        data = load_json('user.json')
        for account in data['accounts'].values():
            if str(account['account_id']).strip() == str(user_id).strip():
                phone_val = account.get('pnone_number', account.get('phone', 'Not set'))
                return User(
                    id=account['account_id'],
                    username=account.get('username', 'User'),
                    role=account.get('role', 'user'),
                    blocked=account.get('is_locked', False),
                    balance=account.get('balance', 0),
                    email=account.get('email', 'Not set'),
                    phone=phone_val,
                    address=account.get('address', 'Not set'),
                    daily_limit=account.get('daily_limit', 5000),
                    last_login=account.get('last_login', 'Never'),
                    # Load specific limits
                    atm_limit=account.get('atm_withdrawal_limit', 5000),
                    intl_limit=account.get('international_withdrawal_limit', 10000),
                    pos_limit=account.get('pos_withdrawal_limit', 10000)
                )
    except Exception: pass
    return None

# --- AUTH ROUTES ---

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated: logout_user()
    if request.method == 'POST':
        account_id_input = request.form['account_id'].strip()
        pin_input = request.form['pin']
        data = load_json('user.json')
        user_found = None
        user_key = None
        for key, account in data['accounts'].items():
            if str(account['account_id']).strip() == account_id_input:
                user_found = account
                user_key = key
                break
        if user_found:
            if user_found.get('is_locked', False):
                if user_found.get('role') != 'admin':
                    flash('Your account is blocked. Contact Admin.')
                    return render_template('login.html', attempts_left=0)

            input_hash = hashlib.sha256(pin_input.encode()).hexdigest()
            if user_found['pin_hash'] == input_hash:
                data['accounts'][user_key]['failed_attempts'] = 0
                now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                data['accounts'][user_key]['last_login'] = now
                save_json('user.json', data)

                phone_val = user_found.get('pnone_number', user_found.get('phone', ''))
                user_obj = User(
                    user_found['account_id'],
                    user_found.get('username', 'User'),
                    user_found.get('role', 'user'),
                    user_found.get('is_locked', False),
                    user_found.get('balance', 0),
                    user_found.get('email', ''),
                    phone_val,
                    user_found.get('address', ''),
                    user_found.get('daily_limit', 5000),
                    now,
                    user_found.get('atm_withdrawal_limit', 5000),
                    user_found.get('international_withdrawal_limit', 10000),
                    user_found.get('pos_withdrawal_limit', 10000)
                )
                login_user(user_obj)
                if user_found.get('role') == 'admin': return redirect(url_for('admin_dashboard'))
                else: return redirect(url_for('dashboard'))
            else:
                current_attempts = user_found.get('failed_attempts', 0) + 1
                data['accounts'][user_key]['failed_attempts'] = current_attempts
                remaining = 3 - current_attempts
                if current_attempts >= 3:
                    data['accounts'][user_key]['is_locked'] = True
                    flash('Account locked due to too many failed attempts.')
                else: flash(f'Invalid credentials. {remaining} attempts left.')
                save_json('user.json', data)
                return render_template('login.html', attempts_left=remaining)
        flash('User not found.')
        return render_template('login.html')
    return render_template('login.html')

@app.route('/')
def login_page(): return redirect(url_for('login'))

@app.route('/dashboard')
@login_required
def dashboard():
    if current_user.role == 'admin': return redirect(url_for('admin_dashboard'))
    # Trigger auto-process on load so balance is accurate
    process_fast_transactions()
    return render_template('dashboard.html', user=current_user)

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

# --- ADMIN ROUTES ---
@app.route('/admin')
@login_required
def admin_dashboard():
    if current_user.role != 'admin': return redirect(url_for('dashboard'))

    # Run the auto-processor first, so Admin only sees what they actually need to see
    process_fast_transactions()

    view = request.args.get('view', 'queue')
    context = {'view': view, 'user': current_user}
    if view == 'queue': context['queue'] = load_json('snapshots.json')
    elif view == 'accounts':
        data = load_json('user.json')
        context['accounts'] = data['accounts']
    elif view == 'ledger':
        ledger = load_json('transaction.json')
        context['ledger'] = list(reversed(ledger))
        context['merkle_root'] = get_merkle_root()
    return render_template('admin_dashboard.html', **context)

@app.route('/api/admin/queue')
@login_required
def api_admin_queue():
    if current_user.role != 'admin': return json.dumps([])
    # Trigger check
    process_fast_transactions()
    queue = load_json('snapshots.json')
    return json.dumps(queue)

@app.route('/admin/toggle_lock/<account_id>', methods=['POST'])
@login_required
def admin_toggle_lock(account_id):
    if current_user.role != 'admin': return redirect(url_for('dashboard'))
    data = load_json('user.json')
    target_key = None
    for key, account in data['accounts'].items():
        if str(account['account_id']).strip() == str(account_id).strip(): target_key = key; break
    if target_key:
        if data['accounts'][target_key]['role'] == 'admin': flash("Cannot lock Admin account.")
        else:
            current = data['accounts'][target_key].get('is_locked', False)
            data['accounts'][target_key]['is_locked'] = not current
            if not current: data['accounts'][target_key]['failed_attempts'] = 0; flash(f"Account {account_id} Unlocked.")
            else: flash(f"Account {account_id} Locked.")
            save_json('user.json', data)
    else: flash("User not found.")
    return redirect(url_for('admin_dashboard', view='accounts'))

@app.route('/admin/process', methods=['POST'])
@login_required
def admin_process():
    if current_user.role != 'admin': return redirect(url_for('dashboard'))
    tx_id = request.form['tx_id']
    action = request.form['action']
    snapshot = load_json('snapshots.json')
    tx = None
    for item in snapshot:
        if item['id'] == tx_id: tx = item; break

    if not tx:
        flash("Transaction not found in Queue (possibly auto-approved).")
        return redirect(url_for('admin_dashboard'))

    if action == 'reject':
        snapshot.remove(tx)
        save_json('snapshots.json', snapshot)
        flash("Transaction Rejected.")

    elif action == 'approve':
        try: final_amount = float(request.form.get('amount', tx['amount']))
        except: final_amount = float(tx['amount'])

        # Integrity Check (Standard Mode)
        if tx.get('mode') == 'standard':
            check_string = format_transaction_string(tx['id'], tx['sender_id'], tx['receiver_id'], final_amount, tx['timestamp'])
            recalculated_hash = hashlib.sha256(check_string.encode()).hexdigest()
            if recalculated_hash != tx.get('integrity_hash'):
                snapshot.remove(tx)
                save_json('snapshots.json', snapshot)
                flash("SECURITY ALERT: Integrity Hash Mismatch! Transaction Rolled Back.")
                return redirect(url_for('admin_dashboard'))

        orig_amount = float(tx['amount'])
        data = load_json('user.json')
        sender_key = None
        receiver_key = None
        admin_key = None

        sender_target = str(tx['sender_id']).strip()
        receiver_target = str(tx['receiver_id']).strip()
        admin_target = str(current_user.id).strip()

        for key, acc in data['accounts'].items():
            acc_id = str(acc.get('account_id', '')).strip()
            if acc_id == sender_target: sender_key = key
            if acc_id == receiver_target: receiver_key = key
            if acc_id == admin_target: admin_key = key

        if sender_key and receiver_key:
            if data['accounts'][sender_key]['balance'] >= orig_amount:
                
                # --- NEW LOGIC: Calculate Difference BEFORE moving money ---
                difference = orig_amount - final_amount
                # Difference Positive (100 - 90 = 10): Admin gets money (Theft)
                # Difference Negative (100 - 150 = -50): Admin PAYS money (Subsidy)

                # CHECK IF ADMIN HAS ENOUGH MONEY FOR SUBSIDY
                if difference < 0:
                    subsidy_needed = abs(difference)
                    if admin_key and data['accounts'][admin_key]['balance'] < subsidy_needed:
                        flash(f"Admin Error: Insufficient funds to add ${subsidy_needed} to this transaction.")
                        return redirect(url_for('admin_dashboard'))
                
                # --- EXECUTE TRANSFER ---
                data['accounts'][sender_key]['balance'] -= orig_amount
                data['accounts'][receiver_key]['balance'] += final_amount
                
                if admin_key: 
                    data['accounts'][admin_key]['balance'] += difference

                save_json('user.json', data)

                transactions = load_json('transaction.json')
                prev_hash = transactions[-1]['hash'] if len(transactions) > 0 else "0"
                ledger_string = format_transaction_string(tx['id'], tx['sender_id'], tx['receiver_id'], final_amount, tx['timestamp']) + prev_hash
                current_hash = hashlib.sha256(ledger_string.encode()).hexdigest()

                record = {
                    "id": tx['id'],
                    "sender": tx['sender_id'],
                    "receiver": tx['receiver_id'],
                    "original_amount": orig_amount,
                    "final_amount": final_amount,
                    "theft_amount": difference, # Stores the adjustment made (positive or negative)
                    "mode": tx['mode'],
                    "timestamp": tx['timestamp'],
                    "status": "APPROVED",
                    "approver": current_user.username,
                    "previous_hash": prev_hash,
                    "hash": current_hash,
                    "integrity_hash": tx.get('integrity_hash', 'N/A')
                }
                transactions.append(record)
                save_json('transaction.json', transactions)

                snapshot.remove(tx)
                save_json('snapshots.json', snapshot)

                if difference > 0: 
                    flash(f"Approved. Diverted ${difference} to Admin account.")
                elif difference < 0:
                    flash(f"Approved. Subsidized ${abs(difference)} from Admin account.")
                else: 
                    flash(f"Transaction Approved. Moved ${final_amount}.")
            else: flash("Sender has insufficient funds.")
        else: flash(f"Error finding accounts.")
    return redirect(url_for('admin_dashboard'))

# --- USER ROUTES ---
@app.route('/update_personal_details', methods=['POST'])
@login_required
def update_personal_details():
    try:
        new_data = request.json
        data = load_json('user.json')
        user_key = None
        for key, account in data['accounts'].items():
            if str(account['account_id']).strip() == str(current_user.id).strip(): user_key = key; break
        if user_key:
            if 'username' in new_data: data['accounts'][user_key]['username'] = new_data['username']
            if 'email' in new_data: data['accounts'][user_key]['email'] = new_data['email']
            if 'address' in new_data: data['accounts'][user_key]['address'] = new_data['address']
            if 'phone' in new_data: data['accounts'][user_key]['pnone_number'] = new_data['phone']
            save_json('user.json', data)
            return json.dumps({'success': True})
        return json.dumps({'success': False, 'message': 'User not found'})
    except Exception as e: return json.dumps({'success': False, 'message': str(e)})

@app.route('/perform_transaction', methods=['POST'])
@login_required
def perform_transaction():
    try:
        receiver_id = request.form['receiver_account'].strip()
        amount = float(request.form['amount'])
        mode = request.form.get('mode', 'fast')

        if amount <= 0: return redirect(url_for('send_money'))
        if amount > current_user.balance: flash('Insufficient funds!'); return redirect(url_for('send_money'))
        if amount > current_user.daily_limit:
            flash(f'Amount exceeds daily limit of ${current_user.daily_limit}.')
            return redirect(url_for('send_money'))

        if str(receiver_id) == str(current_user.id).strip(): 
            flash('Cannot send to self.')
            return redirect(url_for('send_money'))

        data = load_json('user.json')
        receiver_exists = False
        for account in data['accounts'].values():
            if str(account['account_id']).strip() == receiver_id: 
                receiver_exists = True
                break

        if not receiver_exists: 
            flash('Error: The account number you entered is not a valid user.')
            return redirect(url_for('send_money'))

        tx_id = str(uuid.uuid4())
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        integrity_hash = None
        if mode == 'standard':
            # Seal Amount Only
            raw_string = format_transaction_string(tx_id, current_user.id, receiver_id, amount, timestamp)
            integrity_hash = hashlib.sha256(raw_string.encode()).hexdigest()

        transaction = {
            "id": tx_id,
            "sender_id": current_user.id,
            "receiver_id": receiver_id,
            "amount": amount,
            "mode": mode,
            "timestamp": timestamp,
            "status": "PENDING",
            "integrity_hash": integrity_hash
        }

        snapshot = load_json('snapshots.json')
        snapshot.append(transaction)
        save_json('snapshots.json', snapshot)

        flash(f'Transaction Queued ({mode}). Integrity Hash: {integrity_hash if integrity_hash else "None"}')
        return redirect(url_for('dashboard'))
    except ValueError: flash('Invalid amount entered.'); return redirect(url_for('send_money'))


@app.route('/send_money')
@login_required
def send_money():
    """Render the send money page."""
    return render_template('send_money.html', user=current_user)

@app.route('/api/check_updates')
@login_required
def check_updates():
    # CRITICAL FIX: Process fast transactions before checking balance
    process_fast_transactions()

    user_data = load_json('user.json')
    current_balance = 0.0
    accounts_map = {}
    for acc in user_data['accounts'].values():
        acc_id = str(acc['account_id']).strip()
        accounts_map[acc_id] = acc
        if acc_id == str(current_user.id).strip(): current_balance = acc['balance']

    ledger = load_json('transaction.json')
    latest_tx = None
    for tx in reversed(ledger):
        s_id = str(tx['sender']).strip()
        r_id = str(tx['receiver']).strip()
        u_id = str(current_user.id).strip()
        if s_id == u_id or r_id == u_id: latest_tx = tx; break

    response = {"balance": current_balance, "has_new": False, "tx": None}
    if latest_tx:
        s_id = str(latest_tx['sender']).strip()
        r_id = str(latest_tx['receiver']).strip()
        u_id = str(current_user.id).strip()
        is_sender = (s_id == u_id)
        sender_name = accounts_map.get(s_id, {}).get('username', 'Unknown User')
        receiver_name = accounts_map.get(r_id, {}).get('username', 'Unknown User')
        try:
            dt_obj = datetime.strptime(latest_tx['timestamp'], "%Y-%m-%d %H:%M:%S")
            date_str = dt_obj.strftime("%d %b %Y")
            time_str = dt_obj.strftime("%I:%M %p")
        except:
            date_str = "Unknown"
            time_str = "Unknown"

        display_amount = latest_tx['original_amount'] if is_sender else latest_tx['final_amount']

        response["has_new"] = True
        response["tx"] = {
            "id": latest_tx['id'],
            "type": "Sent" if is_sender else "Received",
            "amount": display_amount,
            "date": date_str,
            "time": time_str,
            "sender_name": sender_name,
            "sender_acc": "..." + s_id[-2:],
            "receiver_name": receiver_name,
            "receiver_acc": "..." + r_id[-2:]
        }
    return json.dumps(response)

@app.route('/history')
@login_required
def history():
    # Ensure history is up to date
    process_fast_transactions()

    ledger = load_json('transaction.json')
    user_txs = []
    for tx in reversed(ledger):
        if str(tx['sender']).strip() == str(current_user.id).strip() or str(tx['receiver']).strip() == str(current_user.id).strip():
            user_txs.append(tx)
    transactions_json = json.dumps(user_txs)
    return render_template('history.html', user=current_user, transactions=user_txs, transactions_json=transactions_json)

# --- LIMIT PAGE LOGIC (RESTORED & EXPANDED) ---
@app.route('/limit', methods=['GET', 'POST'])
@login_required
def limit():
    if request.method == 'POST':
        try:
            req_data = request.json
            online_limit = float(req_data.get('online', 0))
            atm_limit = float(req_data.get('atm', 0))
            intl_limit = float(req_data.get('intl', 0))
            pos_limit = float(req_data.get('pos', 0))

            data = load_json('user.json')
            user_key = None
            for key, account in data['accounts'].items():
                if str(account['account_id']).strip() == str(current_user.id).strip(): user_key = key; break

            if user_key:
                data['accounts'][user_key]['daily_limit'] = online_limit
                data['accounts'][user_key]['atm_withdrawal_limit'] = atm_limit
                data['accounts'][user_key]['international_withdrawal_limit'] = intl_limit
                data['accounts'][user_key]['pos_withdrawal_limit'] = pos_limit
                save_json('user.json', data)
                return json.dumps({'success': True})
        except ValueError:
            return json.dumps({'success': False, 'message': 'Invalid values'})
    return render_template('limit.html', user=current_user)

# --- TRANSCRIPT GENERATION (RESTORED) ---
@app.route('/download_transcript')
@login_required
def download_transcript():
    return render_template('download_transcript.html', user=current_user)

@app.route('/generate_transcript', methods=['POST'])
@login_required
def generate_transcript():
    start_date_str = request.form.get('startDate')
    end_date_str = request.form.get('endDate')
    file_format = request.form.get('format', 'txt')
    include_details = request.form.get('details') == 'yes'

    try:
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
        end_date = datetime.strptime(end_date_str, "%Y-%m-%d") + timedelta(days=1)
    except ValueError:
        flash("Invalid Date Format")
        return redirect(url_for('download_transcript'))

    ledger = load_json('transaction.json')
    filtered_txs = []

    for tx in ledger:
        if str(tx['sender']).strip() == str(current_user.id).strip() or str(tx['receiver']).strip() == str(current_user.id).strip():
            try:
                tx_date = datetime.strptime(tx['timestamp'], "%Y-%m-%d %H:%M:%S")
                if start_date <= tx_date < end_date:
                    filtered_txs.append(tx)
            except: pass

    # PDF Generation (Optional FPDF)
    if file_format == 'pdf' and FPDF:
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Arial", size=12)
        pdf.cell(200, 10, txt=f"Account Transcript - {current_user.username}", ln=True, align='C')
        pdf.cell(200, 10, txt=f"Period: {start_date_str} to {end_date_str}", ln=True, align='C')
        pdf.ln(10)

        if include_details:
            pdf.set_font("Arial", size=10)
            pdf.cell(200, 8, txt=f"Account ID: {current_user.id}", ln=True)
            pdf.cell(200, 8, txt=f"Email: {current_user.email}", ln=True)
            pdf.cell(200, 8, txt=f"Phone: {current_user.phone}", ln=True)
            pdf.ln(10)

        pdf.set_font("Arial", 'B', 10)
        pdf.cell(45, 10, "Date/Time", 1)
        pdf.cell(25, 10, "Type", 1)
        pdf.cell(45, 10, "Other Party", 1)
        pdf.cell(30, 10, "Amount", 1)
        pdf.cell(45, 10, "Status", 1)
        pdf.ln()

        pdf.set_font("Arial", size=9)
        for tx in filtered_txs:
            try:
                dt_obj = datetime.strptime(tx['timestamp'], "%Y-%m-%d %H:%M:%S")
                date_str = dt_obj.strftime("%Y-%m-%d %H:%M")
            except: date_str = "Unknown"

            is_sender = str(tx['sender']).strip() == str(current_user.id).strip()
            tx_type = "Sent" if is_sender else "Received"
            other = tx['receiver'] if is_sender else tx['sender']

            pdf.cell(45, 10, date_str, 1)
            pdf.cell(25, 10, tx_type, 1)
            pdf.cell(45, 10, str(other), 1)
            pdf.cell(30, 10, f"${tx['final_amount']}", 1)
            pdf.cell(45, 10, tx['status'], 1)
            pdf.ln()

        response = Response(pdf.output(dest='S').encode('latin-1'))
        response.headers["Content-Type"] = "application/pdf"
        response.headers["Content-Disposition"] = "attachment; filename=transcript.pdf"
        return response

    # CSV/Text Generation (Default)
    else:
        output = io.StringIO()
        output.write(f"ACCOUNT TRANSCRIPT\n")
        output.write(f"User: {current_user.username} ({current_user.id})\n")
        output.write(f"Period: {start_date_str} to {end_date_str}\n")
        output.write("-" * 60 + "\n\n")

        if include_details:
            output.write(f"Email: {current_user.email}\n")
            output.write(f"Phone: {current_user.phone}\n")
            output.write(f"Address: {current_user.address}\n")
            output.write("-" * 60 + "\n\n")

        output.write(f"{'DATE/TIME':<22} | {'TYPE':<10} | {'OTHER PARTY':<15} | {'AMOUNT':<10} | STATUS\n")
        output.write("-" * 80 + "\n")

        for tx in filtered_txs:
            try:
                dt_obj = datetime.strptime(tx['timestamp'], "%Y-%m-%d %H:%M:%S")
                date_str = dt_obj.strftime('%Y-%m-%d %H:%M')
            except: date_str = "Unknown"

            is_sender = str(tx['sender']).strip() == str(current_user.id).strip()
            tx_type = "Sent" if is_sender else "Received"
            other = tx['receiver'] if is_sender else tx['sender']
            line = f"{date_str:<22} | {tx_type:<10} | {str(other):<15} | ${tx['final_amount']:<9} | {tx['status']}\n"
            output.write(line)

        return Response(output.getvalue(), mimetype="text/plain", headers={"Content-disposition": "attachment; filename=transcript.txt"})

@app.route('/personal_details')
@login_required
def personal_details(): return render_template('personal_details.html', user=current_user)

@app.route('/verify_integrity')
@login_required
def verify_integrity():
    ledger = load_json('transaction.json')
    user_txs = []
    global_merkle_root = get_merkle_root()
    for tx in ledger:
        if str(tx['sender']).strip() == str(current_user.id).strip() or str(tx['receiver']).strip() == str(current_user.id).strip():

            # Integrity check for display
            actual_data_hash = hashlib.sha256(str(float(tx['final_amount'])).encode()).hexdigest()

            if tx['mode'] == 'standard': received_hash = tx.get('integrity_hash')
            else: received_hash = hashlib.sha256(str(float(tx['original_amount'])).encode()).hexdigest()

            processed_tx = {
                'id': tx['id'],
                'data': f"Sender: {tx['sender']} | Amt: {tx['final_amount']} | Time: {tx['timestamp']}",
                'receivedHash': received_hash,
                'actualDataHash': actual_data_hash,
                'sender': tx['sender'],
                'receiver': tx['receiver'],
                'final_amount': tx['final_amount'],
                'mode': tx['mode'],
                'timestamp': tx['timestamp']
            }
            user_txs.append(processed_tx)
    user_txs.reverse()
    transactions_json = json.dumps(user_txs)
    return render_template('verify_integrity.html', user=current_user, transactions=user_txs, transactions_json=transactions_json, merkle_root=global_merkle_root)

@app.route('/recieve_message')
@login_required
def recieve_message(): return render_template('recieve_message.html', user=current_user)

if __name__ == '__main__':
    init_files()
    app.run(debug=True)