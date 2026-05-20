// ==========================================
// 0. MODERN UI SYSTEM
// ==========================================
const ui = {
    toast: function(message, type = 'info') {
        const container = document.getElementById('toast-root');
        const toast = document.createElement('div');
        const colors = { success: 'bg-emerald-500 text-white', error: 'bg-rose-500 text-white', sync: 'bg-indigo-600 text-white', info: 'bg-slate-800 text-white' };
        const icons = { success: 'check-circle', error: 'alert-circle', sync: 'refresh-cw', info: 'info' };
        
        toast.className = `flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl toast-slide font-bold text-sm pointer-events-auto ${colors[type]}`;
        toast.innerHTML = `<i data-lucide="${icons[type]}" class="w-5 h-5 ${type==='sync'?'animate-spin':''}"></i> <span>${message}</span>`;
        container.appendChild(toast);
        if(window.lucide) lucide.createIcons({ root: toast });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all 0.4s ease';
            setTimeout(() => toast.remove(), 400);
        }, type === 'sync' ? 8000 : 3500);
    },

    modal: function(options) {
        const { title, text, type = 'alert', confirmText = 'ตกลง', cancelText = 'ยกเลิก', onConfirm } = options;
        const root = document.getElementById('modal-root');
        const iconHtml = type === 'prompt' ? '<i data-lucide="help-circle" class="w-8 h-8 text-indigo-400"></i>' : type === 'confirm' ? '<i data-lucide="alert-triangle" class="w-8 h-8 text-amber-400"></i>' : '<i data-lucide="info" class="w-8 h-8 text-blue-400"></i>';
        const inputHtml = type === 'prompt' ? `<input type="text" id="modal-input" class="w-full mt-4 p-4 rounded-xl input-field border outline-none focus:border-indigo-500 font-bold" placeholder="พิมพ์ข้อความที่นี่..." autocomplete="off">` : '';
        const cancelBtn = (type === 'confirm' || type === 'prompt') ? `<button id="modal-cancel" class="flex-1 py-4 rounded-xl font-bold bg-white/5 hover:bg-white/10 text-slate-300 transition"> ${cancelText} </button>` : '';

        root.innerHTML = `
            <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity">
                <div class="bg-[#0f1524] border border-white/10 rounded-[2rem] p-8 max-w-sm w-full shadow-2xl zoom-in">
                    <div class="flex items-center gap-4 mb-4"><div class="p-3 bg-white/5 rounded-2xl">${iconHtml}</div><h3 class="text-2xl font-black text-white">${title}</h3></div>
                    <p class="text-slate-400 text-sm font-medium leading-relaxed">${text}</p>
                    ${inputHtml}
                    <div class="flex gap-3 mt-8">
                        ${cancelBtn}
                        <button id="modal-confirm" class="flex-1 py-4 rounded-xl font-black bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-lg shadow-indigo-500/20"> ${confirmText} </button>
                    </div>
                </div>
            </div>
        `;
        if(window.lucide) lucide.createIcons({ root: root });
        if(type === 'prompt') document.getElementById('modal-input').focus();
        
        const closeModal = () => root.innerHTML = '';
        document.getElementById('modal-confirm').onclick = () => {
            const val = type === 'prompt' ? document.getElementById('modal-input').value.trim() : true;
            if (type === 'prompt' && !val) return; 
            closeModal();
            if (onConfirm) onConfirm(val);
        };
        if (document.getElementById('modal-cancel')) document.getElementById('modal-cancel').onclick = closeModal;
    }
};

// ==========================================
// 1. STATE & DATA CONFIG
// ==========================================
const state = {
    isLoggedIn: sessionStorage.getItem('comms_logged_in') === 'true',
    user: JSON.parse(sessionStorage.getItem('comms_user')) || null,
    currentView: 'dashboard',
    isMobileMenuOpen: false,
    theme: localStorage.getItem('comms_theme') || 'dark',
    
    // ⚠️ นำ URL จาก Apps Script (New Deployment) มาใส่ในช่องด้านล่างนี้
    gasUrl: 'https://script.google.com/macros/s/AKfycbyU9tiY99-UTEIkGlcMM85tyZaV2TbwQtnd2pX54y8YdIhBo8clI6tqZn4-GUzc5Urd/exec', 
    
    sysConfig: JSON.parse(localStorage.getItem('comms_sysconfig')) || { appName: 'CommsControl', shortName: 'Comms.', logoUrl: '', idleMinutes: 10 },
    devices: [], employees: [], transactions: [], users: [],
    transForm: { type: 'borrow', selectedDevices: [] },
    userForm: { isEditing: false, oldUsername: '' },
    idleTimer: null, autoRefreshInterval: null
};

const navItems = [
    { id: 'dashboard', icon: 'layout-dashboard', label: 'ภาพรวมระบบ' },
    { id: 'transactions', icon: 'arrow-right-left', label: 'เบิก-คืน อุปกรณ์' },
    { id: 'devices', icon: 'radio', label: 'คลังอุปกรณ์' },
    { id: 'employees', icon: 'users', label: 'บุคลากร' },
    { id: 'reports', icon: 'file-bar-chart', label: 'รายงาน' }
];

// ==========================================
// 2. CORE APP ENGINE
// ==========================================
const app = {
    init: function() {
        this.updateDocumentTitle();
        this.applyTheme();
        if (state.isLoggedIn) {
            this.renderMainLayout();
            this.startSessionTracking();
            this.fetchData();
            this.startAutoRefresh();
        } else {
            this.renderLoginScreen();
        }
    },

    updateDocumentTitle: function() {
        document.getElementById('doc-title').innerText = `${state.sysConfig.appName} - ระบบจัดการวิทยุสื่อสาร`;
    },

    getLogoHTML: function(sizeClass = "w-6 h-6") {
        if (state.sysConfig.logoUrl) return `<img src="${state.sysConfig.logoUrl}" class="${sizeClass} object-cover rounded-md" alt="Logo" onerror="this.src=''; this.onerror=null;">`;
        return `<i data-lucide="radio" class="${sizeClass}"></i>`;
    },

    handleLogin: async function(e) {
        e.preventDefault();
        const user = document.getElementById('login-user').value.trim();
        const pass = document.getElementById('login-pass').value.trim();

        if (!state.gasUrl || state.gasUrl === 'ใส่_URL_ของ_APPS_SCRIPT_ที่นี่') {
            ui.modal({ title: 'เกิดข้อผิดพลาด', text: 'คุณยังไม่ได้ใส่ URL ของ Google Apps Script ในไฟล์ app.js ครับ' });
            return;
        }

        ui.toast('กำลังตรวจสอบสิทธิ์การเข้าใช้งาน...', 'sync');
        try {
            const res = await fetch(state.gasUrl, {
                method: 'POST',
                body: JSON.stringify({ action: 'login', username: user, password: pass }),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            });
            const data = await res.json();
            
            if (data.success && data.user) {
                this.processLoginSuccess(data.user);
            } else {
                ui.modal({ title: 'เข้าสู่ระบบล้มเหลว', text: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง' });
            }
        } catch (err) {
            ui.modal({ title: 'ข้อผิดพลาดเครือข่าย', text: 'ไม่สามารถเชื่อมต่อระบบได้ ตรวจสอบว่าคุณ Deploy ใหม่เป็น "ทุกคน (Anyone)" หรือยัง' });
        }
    },

    processLoginSuccess: function(userObj) {
        state.isLoggedIn = true;
        state.user = userObj;
        sessionStorage.setItem('comms_logged_in', 'true');
        sessionStorage.setItem('comms_user', JSON.stringify(state.user));
        this.renderMainLayout();
        this.startSessionTracking();
        this.fetchData();
        this.startAutoRefresh();
        ui.toast(`ยินดีต้อนรับคุณ ${userObj.username}`, 'success');
    },

    handleLogout: function(reason) {
        state.isLoggedIn = false;
        state.user = null;
        sessionStorage.clear();
        clearInterval(state.autoRefreshInterval);
        this.stopSessionTracking();
        this.renderLoginScreen();
        
        if (reason === 'idle') {
            setTimeout(() => ui.modal({ title: 'หมดเวลาเชื่อมต่อ', text: `ระบบได้ล็อกเอาต์อัตโนมัติเนื่องจากไม่มีการใช้งานเกิน ${state.sysConfig.idleMinutes} นาที เพื่อความปลอดภัย` }), 200);
        }
    },

    startSessionTracking: function() {
        this.stopSessionTracking();
        const timeoutMs = (state.sysConfig.idleMinutes || 10) * 60 * 1000;
        const resetTimer = () => {
            clearTimeout(state.idleTimer);
            if (state.isLoggedIn) state.idleTimer = setTimeout(() => this.handleLogout('idle'), timeoutMs);
        };
        window._idleListeners = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(evt => window.addEventListener(evt, resetTimer));
        resetTimer();
    },
    stopSessionTracking: function() { clearTimeout(state.idleTimer); },

    startAutoRefresh: function() {
        clearInterval(state.autoRefreshInterval);
        state.autoRefreshInterval = setInterval(() => {
            if (state.isLoggedIn && state.gasUrl) this.fetchData(true);
        }, 30000); 
    },

    fetchData: async function(isBackground = false) {
        if (!state.gasUrl || state.gasUrl === 'ใส่_URL_ของ_APPS_SCRIPT_ที่นี่') return;
        
        if(!isBackground) this.updateStatus('Loading...', 'spin');
        try {
            const response = await fetch(state.gasUrl);
            const data = await response.json();
            if (data.devices) state.devices = data.devices;
            if (data.employees) state.employees = data.employees;
            if (data.transactions) state.transactions = data.transactions;
            this.updateStatus('Online', 'emerald');
        } catch (error) {
            this.updateStatus('Offline', 'rose');
        } finally {
            if(!isBackground && state.currentView !== 'settings') this.renderCurrentView();
        }
    },

    fetchUsersForAdmin: async function() {
        if (!state.gasUrl || state.user?.role !== 'ผู้ดูแลระบบ') return;
        try {
            const res = await fetch(state.gasUrl, { method: 'POST', body: JSON.stringify({ action: 'getUsers' }), headers: { 'Content-Type': 'text/plain;charset=utf-8' }});
            const data = await res.json();
            if(data.success) {
                state.users = data.users;
                if(state.currentView === 'settings') this.renderCurrentView();
            }
        } catch (e) {}
    },

    syncData: async function(payload, successMsg) {
        this.renderCurrentView(); 
        
        if (!state.gasUrl) return ui.toast('ทำงานในโหมด Offline', 'info');

        ui.toast('กำลังซิงค์ข้อมูลขึ้นคลาวด์...', 'sync');
        this.updateStatus('Syncing...', 'spin');
        
        try {
            const res = await fetch(state.gasUrl, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'text/plain;charset=utf-8' }});
            const json = await res.json();
            if(json.success) {
                this.updateStatus('Online', 'emerald');
                ui.toast(successMsg || 'ซิงค์ข้อมูลสำเร็จ', 'success');
            } else {
                throw new Error(json.error);
            }
        } catch (error) {
            this.updateStatus('Error', 'rose');
            ui.modal({ title: 'ข้อผิดพลาดการซิงค์', text: 'ไม่สามารถบันทึกข้อมูลขึ้น Google Sheets ได้' });
        }
    },

    applyTheme: function() {
        const body = document.getElementById('body-tag');
        if (state.theme === 'light') body.classList.add('light-theme');
        else body.classList.remove('light-theme');
        if(state.isLoggedIn) this.renderNavigation(); 
    },

    toggleTheme: function() {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('comms_theme', state.theme);
        this.applyTheme();
        if(state.currentView === 'settings') this.renderCurrentView();
    },

    updateStatus: function(text, color) {
        const dot = document.getElementById('status-dot');
        const label = document.getElementById('status-text');
        if(label) label.innerText = text;
        if(dot) {
            if (color === 'spin') dot.className = 'w-3 h-3 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin bg-transparent';
            else dot.className = `w-2.5 h-2.5 rounded-full bg-${color}-500 ${color==='emerald' ? 'animate-pulse shadow-[0_0_8px_#10b981]' : ''}`;
        }
    },

    renderLoginScreen: function() {
        document.getElementById('app-root').innerHTML = views.login();
        if(window.lucide) lucide.createIcons();
    },

    renderMainLayout: function() {
        document.getElementById('app-root').innerHTML = views.mainStructure();
        this.renderNavigation();
        this.switchView('dashboard');
    },

    switchView: function(viewId) {
        state.currentView = viewId;
        this.renderNavigation();
        
        if (viewId === 'settings') {
            this.fetchUsersForAdmin(); 
        }
        
        const titles = {
            'dashboard': { title: 'ภาพรวมระบบ', sub: 'ศูนย์ควบคุมและเฝ้าติดตามสถานะอุปกรณ์เรียลไทม์' },
            'transactions': { title: 'Borrow & Return', sub: 'ระบบทำรายการเบิกและคืนอุปกรณ์สื่อสาร' },
            'devices': { title: 'Device Inventory', sub: 'ตรวจสอบสถานะและจัดการคลังวิทยุสื่อสาร' },
            'employees': { title: 'Employee Directory', sub: 'รายชื่อบุคลากรที่มีสิทธิ์เบิกใช้งาน' },
            'reports': { title: 'Analytics & Reports', sub: 'ประวัติการทำรายการและส่งออกข้อมูล' },
            'settings': { title: 'System Settings', sub: 'ศูนย์ควบคุม ตั้งค่าระบบ แสดงผล และผู้ใช้งาน' }
        };
        
        if(titles[viewId]) {
            document.getElementById('page-title').innerText = titles[viewId].title;
            document.getElementById('page-subtitle').innerText = titles[viewId].sub;
        }
        this.renderCurrentView();
    },

    renderCurrentView: function() {
        const container = document.getElementById('view-container');
        if (!container) return;
        container.innerHTML = ''; 
        container.className = 'fade-in pb-32'; 
        
        if(views[state.currentView]) {
            container.innerHTML = views[state.currentView]();
            if(window.lucide) lucide.createIcons({ root: container }); 
            
            if (state.currentView === 'dashboard') {
                setTimeout(() => {
                    const circle = document.getElementById('health-circle');
                    if(circle) circle.style.strokeDashoffset = circle.getAttribute('data-offset');
                }, 100);
            }
        }
    },

    renderNavigation: function() {
        const navContainer = document.getElementById('nav-container');
        if (!navContainer) return;
        navContainer.innerHTML = `<p class="px-5 text-[10px] font-black tracking-[0.2em] uppercase mb-4 text-slate-500">Application</p>`;
        
        navItems.forEach(item => {
            const isActive = state.currentView === item.id;
            const btn = document.createElement('button');
            btn.onclick = () => { this.switchView(item.id); if(state.isMobileMenuOpen) this.toggleMobileMenu(); };
            btn.className = `w-full flex items-center space-x-3 px-5 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden ${isActive ? 'text-white shadow-lg shadow-indigo-900/20' : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'}`;
            btn.innerHTML = `
                ${isActive ? '<div class="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-90"></div>' : ''}
                <div class="relative z-10 flex items-center w-full">
                    <i data-lucide="${item.icon}" class="w-5 h-5 mr-4 ${isActive ? 'scale-110 drop-shadow-[0_0_6px_rgba(255,255,255,0.4)]' : 'group-hover:scale-110'}"></i>
                    <span class="font-semibold text-sm">${item.label}</span>
                </div>
            `;
            navContainer.appendChild(btn);
        });

        const footer = document.getElementById('nav-footer');
        const isSettings = state.currentView === 'settings';
        footer.innerHTML = `
            <button onclick="app.switchView('settings')" class="w-full flex items-center space-x-3 px-5 py-3.5 rounded-xl transition-all hover-item ${isSettings ? 'text-indigo-500 font-bold bg-indigo-500/5' : 'text-slate-400'}">
                <i data-lucide="settings" class="w-5 h-5"></i> <span class="text-sm">ตั้งค่าระบบ</span>
            </button>
            <button onclick="app.toggleTheme()" class="w-full flex items-center space-x-3 px-5 py-3.5 rounded-xl transition-all hover-item text-slate-400 mt-1">
                <i data-lucide="${state.theme === 'dark' ? 'sun' : 'moon'}" class="w-5 h-5"></i> <span class="text-sm">${state.theme === 'dark' ? 'โหมดสว่าง' : 'โหมดมืด'}</span>
            </button>
            <button onclick="ui.modal({type: 'confirm', title: 'ออกจากระบบ', text: 'คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?', onConfirm: () => app.handleLogout()})" class="w-full flex items-center space-x-3 px-5 py-3.5 rounded-xl transition-all hover:text-rose-500 hover:bg-rose-500/10 text-slate-500 border-t border-slate-500/10 mt-2 pt-3">
                <i data-lucide="log-out" class="w-5 h-5"></i> <span class="text-sm">ออกจากระบบ</span>
            </button>
        `;
        if(window.lucide) {
            lucide.createIcons({ root: navContainer });
            lucide.createIcons({ root: footer });
        }
    },

    toggleMobileMenu: function() {
        state.isMobileMenuOpen = !state.isMobileMenuOpen;
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobile-overlay');
        if(state.isMobileMenuOpen) {
            sidebar.classList.remove('-translate-x-full');
            overlay.classList.remove('hidden');
        } else {
            sidebar.classList.add('-translate-x-full');
            overlay.classList.add('hidden');
        }
    },
    
    getStatusHTML: function(status) {
        if (status === 'available') return '<span class="px-3 py-1 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">ว่าง</span>';
        if (status === 'borrowed') return '<span class="px-3 py-1 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">ถูกยืม</span>';
        if (status === 'maintenance') return '<span class="px-3 py-1 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">ส่งซ่อม</span>';
        return '';
    }
};

// ==========================================
// 3. ACTION HANDLERS
// ==========================================
function setTransType(type) { state.transForm.type = type; state.transForm.selectedDevices = []; app.renderCurrentView(); }
function toggleDeviceSelect(id) { 
    const idx = state.transForm.selectedDevices.indexOf(id); 
    if(idx > -1) state.transForm.selectedDevices.splice(idx,1); 
    else state.transForm.selectedDevices.push(id); 
    app.renderCurrentView(); 
}

async function handleTransaction(event) {
    event.preventDefault();
    const type = state.transForm.type;
    const devs = state.transForm.selectedDevices;
    
    const empInput = document.getElementById('trans-emp')?.value || '';
    const location = document.getElementById('trans-loc')?.value || '-';
    const note = document.getElementById('trans-note').value;
    const fileInput = document.getElementById('trans-image');

    if (devs.length === 0) return ui.modal({ title: 'ข้อผิดพลาด', text: 'กรุณาเลือกวิทยุสื่อสารอย่างน้อย 1 เครื่องก่อนยืนยันรายการ' });
    
    let finalEmpId = empInput;
    if (type === 'borrow') {
        if (!empInput) return ui.modal({ title: 'ข้อมูลไม่ครบ', text: 'กรุณาระบุชื่อพนักงานผู้เบิก' });
        if (empInput.includes(' - ')) finalEmpId = empInput.split(' - ')[0]; 
        if (!location) return ui.modal({ title: 'ข้อมูลไม่ครบ', text: 'กรุณาระบุสถานที่นำไปใช้งาน' });
    } else {
        const activeDev = state.devices.find(x => x.id === devs[0]);
        finalEmpId = activeDev?.assignedTo || '';
    }

    let imageBase64 = null;
    if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (file.size > 5 * 1024 * 1024) return ui.modal({ title: 'ไฟล์ใหญ่เกินไป', text: 'กรุณาอัปโหลดรูปภาพขนาดไม่เกิน 5MB' });
        
        ui.toast('กำลังประมวลผลรูปภาพ...', 'sync');
        imageBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
    }

    const timestamp = new Date().toISOString();
    const newTrans = devs.map((devId, i) => ({
        id: `T-${Date.now()}-${i}`, deviceId: devId, employeeId: type === 'borrow' ? finalEmpId : null,
        type, timestamp, note, location: type === 'borrow' ? location : '-', imageBase64 
    }));

    state.transactions = [...newTrans, ...state.transactions];
    const updatedDevices = [];
    state.devices = state.devices.map(d => {
        if (devs.includes(d.id)) {
            const updated = { ...d, status: type === 'borrow' ? 'borrowed' : 'available', assignedTo: type === 'borrow' ? finalEmpId : null };
            updatedDevices.push(updated); return updated;
        }
        return d;
    });

    app.syncData({ action: 'transaction', newTransactions: newTrans, updatedDevices }, `บันทึกรายการ${type==='borrow'?'เบิก':'คืน'} และอัปโหลดไฟล์เรียบร้อย`);
    state.transForm = { type: 'borrow', selectedDevices: [] };
    
    ui.modal({ 
        title: 'สำเร็จ!', 
        text: `ทำรายการ${type==='borrow'?'เบิก':'คืน'}วิทยุจำนวน ${devs.length} เครื่อง เรียบร้อยแล้ว`,
        onConfirm: () => app.switchView('dashboard') 
    });
}

function submitDevice(e) {
    e.preventDefault();
    const id = document.getElementById('dev-id').value.toUpperCase().trim();
    const model = document.getElementById('dev-model').value.trim();
    const serial = document.getElementById('dev-sn').value.trim();

    if (state.devices.find(d => d.id === id)) return ui.modal({ title: 'รหัสซ้ำ', text: 'รหัสอุปกรณ์นี้มีอยู่ในระบบคลังแล้วครับ' });
    const newDev = { id, model, serial, status: 'available', assignedTo: null };
    state.devices.push(newDev);
    app.syncData({ action: 'addDevice', newDevice: newDev }, 'เพิ่มวิทยุสื่อสารเข้าคลังเรียบร้อย');
}

function submitEmployee(e) {
    e.preventDefault();
    const id = document.getElementById('emp-id').value.toUpperCase().trim();
    const name = document.getElementById('emp-name').value.trim();
    const department = document.getElementById('emp-dept').value.trim();
    const phone = document.getElementById('emp-phone').value.trim();

    if (state.employees.find(x => x.id === id)) return ui.modal({ title: 'รหัสซ้ำ', text: 'รหัสบุคลากรนี้มีอยู่ในระบบแล้วครับ' });
    const newEmp = { id, name, department, phone };
    state.employees.push(newEmp);
    app.syncData({ action: 'addEmployee', newEmployee: newEmp }, 'ลงทะเบียนบุคลากรใหม่สำเร็จ');
}

function processStatusChange(id, targetStatus, noteStr) {
    const newTrans = { id: `M-${Date.now()}`, deviceId: id, employeeId: null, type: targetStatus, timestamp: new Date().toISOString(), note: noteStr, location: '-' };
    state.transactions.unshift(newTrans);
    state.devices = state.devices.map(d => d.id === id ? { ...d, status: targetStatus, assignedTo: null } : d);
    app.syncData({ action: 'transaction', newTransactions: [newTrans], updatedDevices: [{ id, status: targetStatus, assignedTo: '' }] }, `อัปเดตสถานะ ${id} เรียบร้อย`);
}

function changeDeviceStatus(id, targetStatus) {
    if(targetStatus === 'maintenance') {
        ui.modal({
            type: 'prompt',
            title: 'แจ้งส่งซ่อม',
            text: `กรุณาระบุอาการเสีย หรือ ปัญหาการใช้งานของเครื่อง ${id}:`,
            confirmText: 'บันทึกส่งซ่อม',
            onConfirm: (note) => processStatusChange(id, targetStatus, `แจ้งซ่อม: ${note}`)
        });
    } else {
        processStatusChange(id, targetStatus, 'ช่างตรวจสภาพและปลดล็อกเครื่องพร้อมใช้งาน');
    }
}

function executeExportCSV() {
    const start = document.getElementById('rep-start').value;
    const end = document.getElementById('rep-end').value;
    let filtered = state.transactions;
    
    if(start) filtered = filtered.filter(t => t.timestamp >= start);
    if(end) {
        const eDate = new Date(end); eDate.setHours(23,59,59);
        filtered = filtered.filter(t => new Date(t.timestamp) <= eDate);
    }
    if(filtered.length === 0) return ui.modal({ title: 'ไม่มีข้อมูล', text: 'ไม่พบประวัติการทำรายการในช่วงเวลาที่ระบุ' });

    const rows = filtered.map(t => {
        const emp = state.employees.find(e => e.id === t.employeeId);
        const typeLabel = t.type==='borrow'?'เบิก':t.type==='maintenance'?'ซ่อม':'คืน';
        return `"${new Date(t.timestamp).toLocaleString('th-TH')}","${typeLabel}","${t.deviceId}","${emp?emp.name:'-'}","${t.location||'-'}","${t.note||'-'}"`;
    });
    const csv = `\ufeff"วัน-เวลา","รายการ","รหัสเครื่อง","ผู้ทำรายการ","สถานที่","หมายเหตุ"\n` + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${state.sysConfig.shortName}_Report_${Date.now()}.csv`; a.click();
    ui.toast('ดาวน์โหลดรายงาน CSV สำเร็จ', 'success');
}

function exportBackupJSON() {
    const backup = { devices: state.devices, employees: state.employees, transactions: state.transactions, users: state.users };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${state.sysConfig.shortName}_Backup_${new Date().toISOString().slice(0,10)}.json`; a.click();
    ui.toast('ดาวน์โหลดไฟล์แบ็คอัปสำเร็จ', 'success');
}

function importBackupJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const data = JSON.parse(evt.target.result);
            ui.modal({
                type: 'confirm',
                title: 'ยืนยันกู้คืนข้อมูล',
                text: `ไฟล์มีข้อมูล: วิทยุ ${data.devices?.length || 0} เครื่อง, บุคลากร ${data.employees?.length || 0} คน<br><br><span class="text-rose-400">คำเตือน: ข้อมูลปัจจุบันจะถูกเขียนทับทั้งหมด ต้องการดำเนินการต่อหรือไม่?</span>`,
                confirmText: 'กู้คืนข้อมูล',
                onConfirm: () => {
                    if(data.devices) state.devices = data.devices;
                    if(data.employees) state.employees = data.employees;
                    if(data.transactions) state.transactions = data.transactions;
                    if(data.users) state.users = data.users;
                    app.renderCurrentView();
                    ui.toast('กู้คืนข้อมูลสำเร็จ', 'success');
                }
            });
        } catch(err) { 
            ui.modal({ title: 'ข้อผิดพลาด', text: 'รูปแบบไฟล์ .json ไม่ถูกต้อง ไม่สามารถอ่านข้อมูลได้' });
        }
    };
    reader.readAsText(file);
}

function saveAppConfig(e) {
    e.preventDefault();
    const appName = document.getElementById('cfg-appname').value.trim() || 'CommsControl';
    const shortName = document.getElementById('cfg-shortname').value.trim() || 'Comms.';
    const logoUrl = document.getElementById('cfg-logo').value.trim();
    const idleMinutes = parseInt(document.getElementById('cfg-idle').value) || 10;
    
    state.sysConfig = { appName, shortName, logoUrl, idleMinutes };
    localStorage.setItem('comms_sysconfig', JSON.stringify(state.sysConfig));
    
    app.updateDocumentTitle();
    app.startSessionTracking(); 
    app.renderMainLayout(); 
    ui.toast('บันทึกการตั้งค่าระบบเรียบร้อย', 'success');
}

function submitSystemUser(e) {
    e.preventDefault();
    const user = document.getElementById('sys-username').value.trim();
    const pass = document.getElementById('sys-password').value.trim();
    const role = document.getElementById('sys-role').value;

    if (state.userForm.isEditing) {
        state.users = state.users.map(u => u.username === state.userForm.oldUsername ? { username: user, password: pass, role } : u);
    } else {
        if (state.users.find(u => u.username === user)) return ui.modal({ title: 'ข้อผิดพลาด', text: 'Username นี้มีผู้ใช้งานแล้ว กรุณาใช้ชื่ออื่น' });
        state.users.push({ username: user, password: pass, role });
    }
    
    app.syncData({ action: 'syncUsers', users: state.users }, 'บันทึกข้อมูลบัญชีผู้ใช้งานสำเร็จ');
    state.userForm = { isEditing: false, oldUsername: '' }; 
}

function editSystemUser(username) {
    const user = state.users.find(u => u.username === username);
    if (!user) return;
    state.userForm = { isEditing: true, oldUsername: user.username };
    app.renderCurrentView();
    setTimeout(() => {
        document.getElementById('sys-username').value = user.username;
        document.getElementById('sys-password').value = user.password;
        document.getElementById('sys-role').value = user.role;
        document.getElementById('sys-username').focus();
    }, 50);
}

function deleteSystemUser(username) {
    if (username === 'admin') return ui.modal({ title: 'ข้อผิดพลาด', text: 'ไม่อนุญาตให้ลบบัญชี admin หลักของระบบเด็ดขาด' });
    if (username === state.user.username) return ui.modal({ title: 'ข้อผิดพลาด', text: 'คุณไม่สามารถลบบัญชีตัวเองที่กำลังล็อกอินอยู่ได้' });
    
    ui.modal({
        type: 'confirm',
        title: 'ยืนยันลบบัญชี',
        text: `คุณแน่ใจหรือไม่ที่จะลบบัญชีผู้ใช้ <b>${username}</b> ออกจากระบบอย่างถาวร?`,
        confirmText: 'ลบบัญชี',
        onConfirm: () => {
            state.users = state.users.filter(u => u.username !== username);
            app.syncData({ action: 'syncUsers', users: state.users }, 'ลบบัญชีผู้ใช้งานสำเร็จ');
        }
    });
}

// ==========================================
// 4. HTML VIEWS
// ==========================================
const views = {
    login: () => `
        <div class="h-screen w-full flex items-center justify-center p-4 relative z-10">
            <div class="w-full max-w-md bg-panel border rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative overflow-hidden fade-in">
                <div class="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-indigo-500/10 blur-xl"></div>
                <div class="flex flex-col items-center mb-8 relative z-10">
                    <div class="p-4 bg-gradient-to-tr from-indigo-500 via-purple-500 to-indigo-500 rounded-2xl shadow-xl text-white mb-4 w-16 h-16 flex items-center justify-center overflow-hidden">
                        ${app.getLogoHTML('w-8 h-8')}
                    </div>
                    <h2 class="text-3xl font-black tracking-tight text-primary">${state.sysConfig.appName}</h2>
                    <p class="text-sm font-medium text-secondary mt-1">ลงชื่อเข้าใช้งานระบบเพื่อควบคุมอุปกรณ์</p>
                </div>
                <form onsubmit="app.handleLogin(event)" class="space-y-5 relative z-10">
                    <div><label class="block text-xs font-bold uppercase tracking-wider mb-2 text-secondary">Username</label><input type="text" id="login-user" required placeholder="ชื่อผู้ใช้งาน..." class="w-full p-4 rounded-xl input-field border outline-none focus:border-indigo-500 font-bold"></div>
                    <div><label class="block text-xs font-bold uppercase tracking-wider mb-2 text-secondary">Password</label><input type="password" id="login-pass" required placeholder="••••••••" class="w-full p-4 rounded-xl input-field border outline-none focus:border-indigo-500 font-bold"></div>
                    <button type="submit" class="w-full py-4 rounded-xl font-black tracking-wide text-white bg-gradient-to-r from-indigo-600 to-purple-600 shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all mt-4">Sign In</button>
                </form>
            </div>
        </div>
    `,

    mainStructure: () => `
        <div class="h-screen w-full flex flex-col md:flex-row relative z-10">
            
            <div class="md:hidden px-5 py-4 flex justify-between items-center bg-panel border-b z-40 flex-shrink-0">
                <div class="flex items-center space-x-3">
                    <div class="p-2 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-lg text-white w-9 h-9 flex items-center justify-center overflow-hidden">${app.getLogoHTML('w-5 h-5')}</div>
                    <span class="font-black text-xl text-primary">${state.sysConfig.shortName}</span>
                </div>
                <button onclick="app.toggleMobileMenu()" class="p-2 rounded-lg text-secondary"><i data-lucide="menu"></i></button>
            </div>

            <aside id="sidebar" class="fixed md:relative top-0 left-0 z-50 md:z-30 h-screen md:h-auto w-64 flex-shrink-0 flex flex-col transform -translate-x-full md:translate-x-0 transition-all duration-300 shadow-2xl md:shadow-none bg-panel border-r border-slate-500/10 backdrop-blur-3xl">
                <div class="p-6 hidden md:flex items-center space-x-3">
                    <div class="p-2.5 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-xl text-white shadow-lg shadow-indigo-500/20 w-11 h-11 flex items-center justify-center overflow-hidden">${app.getLogoHTML('w-6 h-6')}</div>
                    <span class="font-black text-2xl text-primary tracking-tight">${state.sysConfig.shortName}</span>
                </div>
                <nav class="px-4 py-4 space-y-1.5 flex-1 overflow-y-auto hide-scroll" id="nav-container"></nav>
                <div class="p-4 border-t border-slate-500/10 space-y-1" id="nav-footer"></div>
            </aside>

            <div id="mobile-overlay" onclick="app.toggleMobileMenu()" class="fixed inset-0 bg-black/50 z-40 hidden md:hidden backdrop-blur-sm"></div>

            <main class="flex-1 h-screen overflow-y-auto p-5 md:p-8 lg:p-10 scroll-smooth relative">
                <header class="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in">
                    <div>
                        <h1 id="page-title" class="text-4xl font-black text-primary tracking-tight"></h1>
                        <p id="page-subtitle" class="text-sm font-medium text-secondary mt-1"></p>
                    </div>
                    <div class="flex items-center space-x-3">
                        <button onclick="app.fetchData()" class="p-3 rounded-xl bg-panel border border-slate-500/20 transition hover-item text-secondary"><i data-lucide="refresh-cw" class="w-4 h-4"></i></button>
                        <div class="px-4 py-3 rounded-xl bg-panel border border-slate-500/20 flex items-center space-x-2"><div class="w-2 h-2 rounded-full" id="status-dot"></div><span class="text-xs font-bold text-secondary" id="status-text"></span></div>
                    </div>
                </header>
                
                <div id="view-container"></div>
            </main>
        </div>
    `,

    dashboard: () => {
        const total = state.devices.length || 1;
        const avail = state.devices.filter(d => d.status === 'available').length;
        const borr = state.devices.filter(d => d.status === 'borrowed').length;
        const maint = state.devices.filter(d => d.status === 'maintenance').length;
        const healthPct = Math.round((avail / total) * 100) || 0;

        const trRows = state.transactions.slice(0, 6).map(t => {
            const emp = state.employees.find(e => e.id === t.employeeId);
            const typeLabel = t.type === 'borrow' ? 'เบิก' : t.type === 'maintenance' ? 'ซ่อม' : 'คืน';
            const typeColor = t.type === 'borrow' ? 'amber' : t.type === 'maintenance' ? 'rose' : 'emerald';
            return `
                <tr class="border-b border-slate-500/5 hover-item transition-all duration-300">
                    <td class="p-4 text-xs font-medium text-secondary">${new Date(t.timestamp).toLocaleString('th-TH', {dateStyle:'short', timeStyle:'short'})}</td>
                    <td class="p-4"><span class="px-2.5 py-1 rounded border border-${typeColor}-500/20 text-[10px] font-black tracking-widest uppercase bg-${typeColor}-500/10 text-${typeColor}-500 shadow-sm">${typeLabel}</span></td>
                    <td class="p-4 font-black text-primary">${t.deviceId}</td>
                    <td class="p-4 text-sm font-bold text-secondary flex items-center"><div class="w-6 h-6 rounded-full bg-slate-500/20 text-[10px] flex items-center justify-center mr-2">${emp?emp.name.charAt(0):'-'}</div>${emp ? emp.name : '-'}</td>
                    <td class="p-4 text-secondary text-xs font-medium">${t.location || '-'}</td>
                </tr>
            `;
        }).join('') || `<tr><td colspan="5" class="p-10 text-center text-secondary">ไม่มีรายการเคลื่อนไหววันนี้</td></tr>`;

        const dashArray = 351.85;
        const dashOffset = dashArray - (dashArray * healthPct / 100);

        return `
            <div class="space-y-8">
                <div class="relative overflow-hidden rounded-[2.5rem] p-8 md:p-12 border bg-panel shadow-2xl group">
                    <div class="absolute top-0 right-0 w-64 h-64 bg-indigo-500/30 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/4 group-hover:scale-110 transition-transform duration-1000"></div>
                    <div class="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/20 rounded-full blur-[60px] translate-y-1/3 -translate-x-1/4 group-hover:scale-110 transition-transform duration-1000"></div>
                    
                    <div class="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div class="flex-1">
                            <div class="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-4">
                                <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-2"></span> System Online
                            </div>
                            <h2 class="text-3xl md:text-5xl font-black mb-4 text-primary tracking-tight">สวัสดีคุณ, ${state.user?.username}</h2>
                            <p class="text-base md:text-lg text-secondary font-medium max-w-xl">ระบบเฝ้าติดตามสถิติคลังสื่อสารอัจฉริยะ ควบคุมและจัดการทรัพยากรทั้งหมดในองค์กรแบบเรียลไทม์</p>
                        </div>
                        <div class="flex-shrink-0 flex items-center justify-center p-6 bg-black/20 rounded-[2rem] border border-white/5 backdrop-blur-md shadow-inner">
                            <div class="relative w-32 h-32 flex items-center justify-center">
                                <svg class="w-full h-full transform -rotate-90"><circle cx="64" cy="64" r="56" stroke="currentColor" stroke-width="12" fill="transparent" class="text-slate-700/30" /><circle id="health-circle" cx="64" cy="64" r="56" stroke="currentColor" stroke-width="12" fill="transparent" stroke-dasharray="${dashArray}" stroke-dashoffset="${dashArray}" data-offset="${dashOffset}" class="text-indigo-500 progress-ring" stroke-linecap="round" /></svg>
                                <div class="absolute flex flex-col items-center justify-center text-center"><span class="text-3xl font-black text-white">${healthPct}%</span><span class="text-[9px] uppercase tracking-widest text-slate-400 font-bold mt-1">Ready</span></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    <div class="bg-panel p-6 md:p-8 rounded-[2rem] border relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 shadow-lg">
                        <div class="absolute top-0 right-0 w-24 h-24 bg-blue-500/20 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2 group-hover:scale-150 transition-transform duration-700"></div>
                        <div class="flex justify-between items-start mb-4"><div class="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500"><i data-lucide="radio" class="w-6 h-6"></i></div></div>
                        <div><p class="text-4xl font-black text-primary mb-1">${state.devices.length}</p><p class="text-xs text-secondary font-bold tracking-widest uppercase">อุปกรณ์ทั้งหมด</p></div>
                    </div>
                    <div class="bg-panel p-6 md:p-8 rounded-[2rem] border relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 shadow-lg">
                        <div class="absolute top-0 right-0 w-24 h-24 bg-emerald-500/20 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2 group-hover:scale-150 transition-transform duration-700"></div>
                        <div class="flex justify-between items-start mb-4"><div class="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500"><i data-lucide="check-circle-2" class="w-6 h-6"></i></div></div>
                        <div><p class="text-4xl font-black text-primary mb-1">${avail}</p><p class="text-xs text-secondary font-bold tracking-widest uppercase">พร้อมใช้งาน</p></div>
                    </div>
                    <div class="bg-panel p-6 md:p-8 rounded-[2rem] border relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 shadow-lg">
                        <div class="absolute top-0 right-0 w-24 h-24 bg-amber-500/20 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2 group-hover:scale-150 transition-transform duration-700"></div>
                        <div class="flex justify-between items-start mb-4"><div class="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500"><i data-lucide="arrow-right-left" class="w-6 h-6"></i></div></div>
                        <div><p class="text-4xl font-black text-primary mb-1">${borr}</p><p class="text-xs text-secondary font-bold tracking-widest uppercase">ถูกเบิกใช้งาน</p></div>
                    </div>
                    <div class="bg-panel p-6 md:p-8 rounded-[2rem] border relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 shadow-lg">
                        <div class="absolute top-0 right-0 w-24 h-24 bg-rose-500/20 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2 group-hover:scale-150 transition-transform duration-700"></div>
                        <div class="flex justify-between items-start mb-4"><div class="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500"><i data-lucide="wrench" class="w-6 h-6"></i></div></div>
                        <div><p class="text-4xl font-black text-primary mb-1">${maint}</p><p class="text-xs text-secondary font-bold tracking-widest uppercase">แจ้งซ่อม</p></div>
                    </div>
                </div>

                <div class="bg-panel border rounded-[2rem] overflow-hidden shadow-xl">
                    <div class="p-6 md:p-8 border-b border-slate-500/10 flex justify-between items-center">
                        <h2 class="text-xl font-black text-primary flex items-center"><div class="p-2 rounded-lg bg-indigo-500/10 text-indigo-500 mr-3"><i data-lucide="clock" class="w-5 h-5"></i></div> ประวัติรายการล่าสุด</h2>
                        <button onclick="app.switchView('reports')" class="text-sm font-bold text-indigo-500 hover:text-indigo-400 transition flex items-center">ดูทั้งหมด <i data-lucide="chevron-right" class="w-4 h-4 ml-1"></i></button>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left min-w-[700px]">
                            <thead class="text-xs text-secondary table-header font-bold uppercase tracking-wider">
                                <tr><th class="p-5 pl-8">วัน-เวลา</th><th class="p-5">รายการ</th><th class="p-5">รหัสเครื่อง</th><th class="p-5">ผู้ทำรายการ</th><th class="p-5 pr-8">จุดใช้งาน</th></tr>
                            </thead>
                            <tbody>${trRows}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    transactions: () => {
        const t = state.transForm;
        const list = t.type === 'borrow' ? state.devices.filter(d => d.status === 'available') : state.devices.filter(d => d.status === 'borrowed');
        
        const devsHtml = list.length > 0 ? list.map(d => {
            const isSel = t.selectedDevices.includes(d.id);
            const cBorder = isSel ? (t.type==='borrow'?'border-indigo-500 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.2)]':'border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.2)]') : 'border-slate-500/20 bg-black/10';
            const cIcon = isSel ? (t.type==='borrow'?'text-indigo-400':'text-emerald-400') : 'text-slate-500';
            const empName = t.type === 'return' ? `<p class="text-[11px] mt-2 text-amber-400 font-bold bg-amber-500/10 py-1 px-2 rounded w-max">ยืมโดย: ${state.employees.find(e => e.id === d.assignedTo)?.name.split(' ')[0] || d.assignedTo}</p>` : '';
            
            return `
                <div onclick="toggleDeviceSelect('${d.id}')" class="p-5 rounded-2xl border-2 cursor-pointer transition-all transform hover:-translate-y-1 active:scale-95 ${cBorder} relative overflow-hidden">
                    ${isSel ? `<div class="absolute inset-0 bg-gradient-to-br ${t.type==='borrow'?'from-indigo-500/20':'from-emerald-500/20'} to-transparent pointer-events-none"></div>` : ''}
                    <div class="flex justify-between mb-3 relative z-10"><i data-lucide="radio" class="w-6 h-6 ${cIcon}"></i><i data-lucide="${isSel?'check-square':'square'}" class="w-6 h-6 ${cIcon}"></i></div>
                    <p class="font-black text-primary text-lg tracking-wide relative z-10">${d.id}</p>
                    <p class="text-xs text-secondary mt-0.5 font-medium relative z-10">${d.model}</p>
                    <div class="relative z-10">${empName}</div>
                </div>
            `;
        }).join('') : `<div class="col-span-full py-12 text-center border border-dashed border-slate-500/30 rounded-2xl text-secondary flex flex-col items-center justify-center"><i data-lucide="inbox" class="w-12 h-12 mb-3 opacity-20"></i> ไม่มีอุปกรณ์ให้ทำรายการในขณะนี้</div>`;

        const empOptions = state.employees.map(e => `<option value="${e.id} - ${e.name}">`).join('');
        const uniqueLocs = [...new Set(state.transactions.map(tr => tr.location).filter(l => l && l !== '-'))];
        const locOptions = uniqueLocs.map(l => `<option value="${l}">`).join('');

        const submitBtnClass = t.selectedDevices.length > 0 
            ? (t.type==='borrow'?'bg-gradient-to-r from-indigo-600 to-purple-600 shadow-[0_0_25px_rgba(99,102,241,0.4)]':'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_0_25px_rgba(16,185,129,0.4)]')
            : 'bg-slate-700/50 cursor-not-allowed text-slate-400';

        return `
            <div class="max-w-5xl mx-auto space-y-6">
                <div class="flex p-2 bg-panel border rounded-3xl shadow-sm">
                    <button onclick="setTransType('borrow')" class="flex-1 py-4 font-black text-base rounded-2xl transition-all ${t.type==='borrow'?'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-[1.02] z-10':'text-slate-400 hover:text-white'}">เบิกอุปกรณ์</button>
                    <button onclick="setTransType('return')" class="flex-1 py-4 font-black text-base rounded-2xl transition-all ${t.type==='return'?'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 scale-[1.02] z-10':'text-slate-400 hover:text-white'}">คืนอุปกรณ์</button>
                </div>

                <form onsubmit="handleTransaction(event)" class="bg-panel border p-6 md:p-10 rounded-[2.5rem] shadow-2xl space-y-8">
                    <div>
                        <div class="flex justify-between items-center border-b border-slate-500/20 pb-4 mb-4">
                            <label class="font-black text-primary text-xl">1. เลือกวิทยุสื่อสาร</label>
                            <span class="px-4 py-1.5 rounded-full text-xs font-bold bg-white/10 text-slate-300">เลือกแล้ว ${t.selectedDevices.length} เครื่อง</span>
                        </div>
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">${devsHtml}</div>
                    </div>

                    ${t.type === 'borrow' ? `
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-500/20 pt-8">
                            <div>
                                <label class="block font-black text-base text-primary mb-3">2. พนักงานผู้เบิก</label>
                                <div class="relative">
                                    <i data-lucide="user" class="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"></i>
                                    <input type="text" id="trans-emp" list="emp-list" required placeholder="พิมพ์ชื่อหรือรหัสพนักงาน..." class="w-full pl-14 pr-4 py-5 rounded-2xl input-field border outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 font-bold text-base transition-all shadow-inner" autoComplete="off">
                                    <datalist id="emp-list">${empOptions}</datalist>
                                </div>
                            </div>
                            <div>
                                <label class="block font-black text-base text-primary mb-3">3. สถานที่ปฏิบัติงาน</label>
                                <div class="relative">
                                    <i data-lucide="map-pin" class="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"></i>
                                    <input type="text" id="trans-loc" list="loc-list" required placeholder="ระบุจุด/สถานที่ใช้งาน..." class="w-full pl-14 pr-4 py-5 rounded-2xl input-field border outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 font-bold text-base transition-all shadow-inner" autoComplete="off">
                                    <datalist id="loc-list">${locOptions}</datalist>
                                </div>
                            </div>
                        </div>
                    ` : ''}

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-500/20 pt-8">
                        <div>
                            <label class="block font-black text-base text-primary mb-3">หมายเหตุเพิ่มเติม</label>
                            <input type="text" id="trans-note" placeholder="วัตถุประสงค์ หรือ สภาพเครื่อง..." class="w-full px-6 py-5 rounded-2xl input-field border outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 font-medium text-base transition-all shadow-inner">
                        </div>
                        <div>
                            <label class="block font-black text-base text-primary mb-3">แนบรูปภาพหลักฐาน (ตัวเลือก)</label>
                            <input type="file" id="trans-image" accept="image/*" class="w-full px-6 py-4.5 rounded-2xl input-field border outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 font-medium text-sm transition-all shadow-inner file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20">
                        </div>
                    </div>

                    <button type="submit" class="w-full py-6 rounded-[1.5rem] font-black text-white text-xl ${submitBtnClass} hover:scale-[1.02] active:scale-95 transition-all mt-6 flex items-center justify-center gap-3">
                        <span>ยืนยันข้อมูลรายการ (${t.selectedDevices.length} เครื่อง)</span>
                        <i data-lucide="arrow-right" class="w-6 h-6"></i>
                    </button>
                </form>
            </div>
        `;
    },

    devices: () => {
        const list = state.devices.map(d => {
            const name = state.employees.find(e => e.id === d.assignedTo)?.name || d.assignedTo;
            const actionBtn = d.status === 'borrowed' 
                ? `<span class="text-[11px] font-bold text-amber-400 bg-amber-500/10 p-3 rounded-xl border border-amber-500/10 w-full text-center">👤 ถือครองโดย: ${name}</span>`
                : `<button onclick="changeDeviceStatus('${d.id}', '${d.status==='maintenance'?'available':'maintenance'}')" class="text-xs font-bold px-3 py-3 rounded-xl w-full border ${d.status==='maintenance'?'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20':'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'} transition shadow-sm">${d.status==='maintenance'?'🔧 ปลดล็อกเครื่อง':'🛠️ แจ้งส่งซ่อม'}</button>`;

            return `
                <div class="bg-panel border p-6 rounded-3xl flex flex-col hover:border-slate-500/30 transition hover:-translate-y-1 shadow-lg hover:shadow-xl">
                    <div class="flex justify-between items-start mb-4">
                        <div class="p-3 bg-white/5 rounded-xl text-secondary shadow-inner"><i data-lucide="radio" class="w-6 h-6"></i></div>
                        ${app.getStatusHTML(d.status)}
                    </div>
                    <h3 class="font-black text-2xl text-primary tracking-wide">${d.id}</h3>
                    <p class="text-xs text-secondary mt-1 font-bold">${d.model}</p>
                    <p class="text-[10px] text-slate-500 mt-2 font-mono bg-black/20 p-1.5 rounded-lg w-max border border-white/5">SN: ${d.serial || '-'}</p>
                    <div class="mt-6 pt-4 border-t border-slate-500/10 flex">${actionBtn}</div>
                </div>
            `;
        }).join('');

        return `
            <div class="space-y-6">
                <form onsubmit="submitDevice(event)" class="bg-panel border p-6 rounded-3xl grid grid-cols-1 md:grid-cols-4 gap-4 items-end shadow-lg">
                    <div><label class="text-xs font-bold text-secondary mb-1 block">รหัสเครื่อง (ID)</label><input type="text" id="dev-id" required placeholder="เช่น R-004" class="w-full p-3.5 rounded-xl input-field border font-bold text-sm"></div>
                    <div><label class="text-xs font-bold text-secondary mb-1 block">รุ่น (Model)</label><input type="text" id="dev-model" required placeholder="เช่น Icom IC-V80" class="w-full p-3.5 rounded-xl input-field border font-bold text-sm"></div>
                    <div><label class="text-xs font-bold text-secondary mb-1 block">Serial Number</label><input type="text" id="dev-sn" placeholder="ระบุ S/N..." class="w-full p-3.5 rounded-xl input-field border font-bold text-sm"></div>
                    <button type="submit" class="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm p-3.5 rounded-xl flex items-center justify-center transition shadow-lg shadow-indigo-600/20"><i data-lucide="plus" class="w-5 h-5 mr-2"></i> เพิ่มอุปกรณ์</button>
                </form>
                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">${list}</div>
            </div>
        `;
    },

    employees: () => {
        const list = state.employees.map(e => `
            <tr class="border-b border-slate-500/10 hover-item text-sm">
                <td class="p-5 font-black text-primary tracking-wide pl-8">${e.id}</td>
                <td class="p-5 font-bold text-primary flex items-center gap-3"><div class="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-xs">${e.name.charAt(0)}</div>${e.name}</td>
                <td class="p-5"><span class="px-3 py-1.5 bg-slate-500/10 border border-slate-500/20 text-secondary rounded-lg text-xs font-semibold">${e.department}</span></td>
                <td class="p-5 text-secondary font-medium tracking-wide pr-8">${e.phone || '-'}</td>
            </tr>
        `).join('') || `<tr><td colspan="4" class="p-10 text-center text-secondary">ไม่มีรายชื่อ</td></tr>`;

        return `
            <div class="space-y-6">
                <form onsubmit="submitEmployee(event)" class="bg-panel border p-6 rounded-3xl grid grid-cols-1 sm:grid-cols-5 gap-4 items-end shadow-lg">
                    <div><label class="text-xs font-bold text-secondary mb-1 block">รหัสบุคลากร</label><input type="text" id="emp-id" required placeholder="EMP-003" class="w-full p-3.5 rounded-xl input-field border text-sm font-bold"></div>
                    <div class="sm:col-span-2"><label class="text-xs font-bold text-secondary mb-1 block">ชื่อ-นามสกุล</label><input type="text" id="emp-name" required placeholder="ชื่อพนักงาน" class="w-full p-3.5 rounded-xl input-field border text-sm font-bold"></div>
                    <div><label class="text-xs font-bold text-secondary mb-1 block">แผนก/ฝ่าย</label><input type="text" id="emp-dept" required placeholder="รปภ. / ช่าง" class="w-full p-3.5 rounded-xl input-field border text-sm font-bold"></div>
                    <div><label class="text-xs font-bold text-secondary mb-1 block">เบอร์ติดต่อ</label><input type="text" id="emp-phone" placeholder="08x-xxx-xxxx" class="w-full p-3.5 rounded-xl input-field border text-sm font-bold"></div>
                    <button type="submit" class="sm:col-span-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm p-4 rounded-xl shadow-lg shadow-indigo-600/20 transition mt-2">ลงทะเบียนบุคลากรใหม่</button>
                </form>
                <div class="bg-panel border rounded-[2rem] overflow-x-auto shadow-xl"><table class="w-full text-left min-w-[600px]"><thead class="text-xs text-secondary table-header uppercase tracking-wider"><tr><th class="p-5 pl-8">รหัส</th><th class="p-5">ชื่อ-สกุล</th><th class="p-5">แผนก</th><th class="p-5 pr-8">เบอร์โทรศัพท์</th></tr></thead><tbody>${list}</tbody></table></div>
            </div>
        `;
    },

    reports: () => {
        const trRows = state.transactions.map(t => {
            const emp = state.employees.find(e => e.id === t.employeeId);
            const label = t.type==='borrow'?'เบิก':t.type==='maintenance'?'ซ่อม':'คืน';
            const color = t.type==='borrow'?'amber':t.type==='maintenance'?'rose':'emerald';
            const imgLink = t.imageUrl && t.imageUrl !== '-' && t.imageUrl.startsWith('http') ? `<a href="${t.imageUrl}" target="_blank" class="text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1 bg-indigo-500/10 px-2 py-1 rounded w-max"><i data-lucide="image" class="w-3 h-3"></i> ดูรูป</a>` : `<span class="text-slate-600">-</span>`;

            return `
                <tr class="border-b border-slate-500/5 hover-item text-sm text-primary transition">
                    <td class="p-5 pl-8 text-secondary text-xs font-medium">${new Date(t.timestamp).toLocaleDateString('th-TH')} <span class="text-slate-500 ml-1">${new Date(t.timestamp).toLocaleTimeString('th-TH')}</span></td>
                    <td class="p-5"><span class="px-3 py-1 bg-${color}-500/10 text-${color}-400 border border-${color}-500/20 text-[10px] font-black tracking-widest uppercase rounded-lg">${label}</span></td>
                    <td class="p-5 font-black text-base">${t.deviceId}</td>
                    <td class="p-5 font-bold text-sm">${emp ? emp.name : '-'}</td>
                    <td class="p-5 text-xs text-secondary font-medium">${t.location || '-'}</td>
                    <td class="p-5 text-xs text-slate-500 font-medium">${t.note || '-'}</td>
                    <td class="p-5 pr-8 text-xs text-secondary font-medium">${imgLink}</td>
                </tr>
            `;
        }).join('') || `<tr><td colspan="7" class="p-16 text-center text-secondary font-bold text-lg"><i data-lucide="file-x" class="w-12 h-12 mx-auto mb-4 opacity-20"></i> ไม่มีประวัติรายงานข้อมูล</td></tr>`;

        return `
            <div class="space-y-6">
                <div class="bg-panel border p-6 rounded-3xl flex flex-wrap gap-4 items-end shadow-lg">
                    <div class="w-full sm:w-auto"><label class="text-xs font-bold text-secondary block mb-2">ตั้งแต่วันที่</label><input type="date" id="rep-start" class="p-3.5 rounded-xl input-field border text-sm font-bold"></div>
                    <div class="w-full sm:w-auto"><label class="text-xs font-bold text-secondary block mb-2">ถึงวันที่</label><input type="date" id="rep-end" class="p-3.5 rounded-xl input-field border text-sm font-bold"></div>
                    <button onclick="executeExportCSV()" class="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm px-8 py-3.5 rounded-xl flex items-center shadow-lg shadow-emerald-600/20 transition h-[50px]"><i data-lucide="download" class="w-5 h-5 mr-2"></i> ส่งออกตารางรายงาน (CSV)</button>
                </div>
                <div class="bg-panel border rounded-[2rem] overflow-x-auto max-h-[60vh] relative shadow-xl"><table class="w-full text-left min-w-[900px]"><thead class="sticky top-0 bg-slate-900/95 backdrop-blur-xl border-b border-slate-500/20 text-secondary text-xs uppercase tracking-wider"><tr class="table-header"><th class="p-5 pl-8">วัน-เวลา</th><th class="p-5">รายการ</th><th class="p-5">เครื่อง</th><th class="p-5">ผู้ปฏิบัติงาน</th><th class="p-5">สถานที่</th><th class="p-5">หมายเหตุ</th><th class="p-5 pr-8">หลักฐาน</th></tr></thead><tbody>${trRows}</tbody></table></div>
            </div>
        `;
    },

    settings: () => {
        const userRows = state.users.map(u => `
            <tr class="border-b border-slate-500/10 hover-item text-sm transition">
                <td class="p-5 pl-8 font-black text-primary">${u.username}</td>
                <td class="p-5 text-secondary text-xs tracking-widest">••••••••</td>
                <td class="p-5"><span class="px-3 py-1 bg-slate-500/10 border border-slate-500/20 text-secondary rounded-lg text-[10px] font-black uppercase tracking-wider">${u.role}</span></td>
                <td class="p-5 pr-8 text-right space-x-2">
                    ${state.user.role === 'ผู้ดูแลระบบ' ? `
                        <button onclick="editSystemUser('${u.username}')" class="p-2.5 rounded-xl transition-colors text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/20"><i data-lucide="edit" class="w-4 h-4"></i></button>
                        <button onclick="deleteSystemUser('${u.username}')" class="p-2.5 rounded-xl transition-colors text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    ` : `<span class="text-xs text-slate-500">ไม่มีสิทธิ์</span>`}
                </td>
            </tr>
        `).join('');

        const isEdit = state.userForm.isEditing;

        return `
        <div class="max-w-4xl mx-auto space-y-8">
            
            <form onsubmit="saveAppConfig(event)" class="bg-panel border p-8 md:p-10 rounded-[2.5rem] shadow-2xl space-y-6">
                <h3 class="text-2xl font-black text-primary flex items-center mb-2"><div class="p-2.5 bg-blue-500/20 rounded-xl mr-4"><i data-lucide="layout" class="w-6 h-6 text-blue-400"></i></div> การแสดงผลและระบบ</h3>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                    <div>
                        <label class="block font-bold text-sm text-secondary mb-3">ชื่อระบบ (App Name)</label>
                        <input type="text" id="cfg-appname" value="${state.sysConfig.appName}" class="w-full p-4 rounded-2xl input-field border outline-none focus:border-indigo-500 font-bold text-sm shadow-inner">
                    </div>
                    <div>
                        <label class="block font-bold text-sm text-secondary mb-3">ชื่อย่อ (Short Name)</label>
                        <input type="text" id="cfg-shortname" value="${state.sysConfig.shortName}" class="w-full p-4 rounded-2xl input-field border outline-none focus:border-indigo-500 font-bold text-sm shadow-inner">
                    </div>
                </div>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <label class="block font-bold text-sm text-secondary mb-3">URL โลโก้ภาพ (เว้นว่างไว้เพื่อใช้ไอคอนระบบ)</label>
                        <input type="url" id="cfg-logo" value="${state.sysConfig.logoUrl}" placeholder="https://..." class="w-full p-4 rounded-2xl input-field border outline-none focus:border-indigo-500 font-bold text-sm shadow-inner">
                    </div>
                    <div>
                        <label class="block font-bold text-sm text-secondary mb-3">เวลา Logout อัตโนมัติ (หน่วย: นาที)</label>
                        <input type="number" id="cfg-idle" min="1" max="1440" value="${state.sysConfig.idleMinutes}" class="w-full p-4 rounded-2xl input-field border outline-none focus:border-indigo-500 font-bold text-sm shadow-inner">
                    </div>
                </div>
                <button type="submit" class="bg-blue-600 hover:bg-blue-500 text-white font-black text-base px-8 py-4 rounded-xl transition shadow-lg shadow-blue-600/20">บันทึกการแสดงผล</button>
            </form>

            <div class="bg-panel border p-8 md:p-10 rounded-[2.5rem] shadow-2xl">
                <h3 class="text-2xl font-black text-primary flex items-center mb-8"><div class="p-2.5 bg-purple-500/20 rounded-xl mr-4"><i data-lucide="users" class="w-6 h-6 text-purple-400"></i></div> การจัดการผู้ใช้งาน</h3>
                ${state.user.role === 'ผู้ดูแลระบบ' ? `
                <form onsubmit="submitSystemUser(event)" class="grid grid-cols-1 sm:grid-cols-4 gap-5 mb-8 bg-black/20 p-6 rounded-[2rem] border border-white/5 shadow-inner">
                    <div><label class="block text-xs font-bold text-secondary mb-2 uppercase tracking-wider">Username</label><input type="text" id="sys-username" required class="w-full p-3.5 rounded-xl input-field border text-sm font-bold"></div>
                    <div><label class="block text-xs font-bold text-secondary mb-2 uppercase tracking-wider">Password</label><input type="text" id="sys-password" required class="w-full p-3.5 rounded-xl input-field border text-sm font-bold"></div>
                    <div><label class="block text-xs font-bold text-secondary mb-2 uppercase tracking-wider">สิทธิ์ (Role)</label><select id="sys-role" class="w-full p-3.5 rounded-xl input-field border text-sm font-bold outline-none cursor-pointer"><option value="เจ้าหน้าที่" class="bg-slate-900 text-white">เจ้าหน้าที่</option><option value="ผู้ดูแลระบบ" class="bg-slate-900 text-white">ผู้ดูแลระบบ</option></select></div>
                    <div class="flex items-end"><button type="submit" class="w-full p-3.5 rounded-xl font-black text-white text-sm transition-all shadow-lg hover:-translate-y-0.5 active:scale-95 ${isEdit ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20' : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/20'}">${isEdit ? 'บันทึกแก้ไข' : 'เพิ่มบัญชี'}</button></div>
                </form>
                ` : `<div class="mb-8 p-5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400 text-sm font-bold flex items-center"><i data-lucide="shield-alert" class="w-5 h-5 mr-3"></i> คุณสามารถดูรายชื่อได้ แต่ต้องเป็น 'ผู้ดูแลระบบ' เท่านั้นถึงจะเพิ่ม/แก้ไขได้</div>`}
                <div class="overflow-x-auto rounded-[2rem] border border-slate-500/10 shadow-inner bg-black/10"><table class="w-full text-left min-w-[600px]"><thead class="text-xs text-secondary table-header uppercase tracking-wider"><tr><th class="p-5 pl-8">Username</th><th class="p-5">Password</th><th class="p-5">Role</th><th class="p-5 pr-8 text-right">Action</th></tr></thead><tbody>${userRows}</tbody></table></div>
            </div>

            <div class="bg-panel border p-8 md:p-10 rounded-[2.5rem] shadow-2xl space-y-6">
                <h3 class="text-2xl font-black text-primary flex items-center mb-6"><div class="p-2.5 bg-emerald-500/20 rounded-xl mr-4"><i data-lucide="download-cloud" class="w-6 h-6 text-emerald-400"></i></div> นำเข้า / ส่งออก ข้อมูล</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <button onclick="exportBackupJSON()" class="p-5 bg-white/5 border border-white/10 rounded-2xl font-bold text-sm text-primary flex items-center justify-center hover-item transition hover:-translate-y-1"><i data-lucide="download" class="w-5 h-5 mr-3 text-blue-400"></i> ดาวน์โหลด Backup (.json)</button>
                    <div class="relative"><input type="file" id="import-file" accept=".json" onchange="importBackupJSON(event)" class="hidden"><label htmlFor="import-file" onclick="document.getElementById('import-file').click()" class="p-5 bg-white/5 border border-white/10 border-dashed rounded-2xl font-bold text-sm text-primary flex items-center justify-center hover-item cursor-pointer transition hover:-translate-y-1"><i data-lucide="upload" class="w-5 h-5 mr-3 text-purple-400"></i> กู้คืนระบบ Restore (.json)</label></div>
                </div>
            </div>
        </div>
        `;
    }
};

// ==========================================
// 6. INITIAL RUN
// ==========================================
document.addEventListener('DOMContentLoaded', () => app.init());
