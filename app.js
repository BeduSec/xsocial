const firebaseConfig = {
    apiKey: "AIzaSyDKbsD-n_2pegTi6pCyh5fOIRkP0wsNhX0",
    authDomain: "xsocial-14f3d.firebaseapp.com",
    projectId: "xsocial-14f3d",
    storageBucket: "xsocial-14f3d.firebasestorage.app",
    messagingSenderId: "367367942169",
    appId: "1:367367942169:web:c24a39eb2b7136ed4ffa88"
  };

const cloudinaryConfig = {
    cloudName: "dsjvlrxdr",
    uploadPreset: "neloreod"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let userData = null;
let currentChatId = null;

auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        const userDoc = await db.collection('users').doc(user.uid).get();
        userData = userDoc.data();
        initApp();
    } else if (!window.location.pathname.includes('login.html')) {
        window.location.href = 'login.html';
    }
});

function initApp() {
    const params = new URLSearchParams(window.location.search);
    const profileUser = params.get('u');
    const searchQuery = params.get('q');

    if (profileUser) {
        showProfile(profileUser);
    } else if (window.location.pathname.includes('search_results.html')) {
        runSearch(searchQuery);
    } else if (window.location.pathname.includes('chat.html')) {
        loadInbox();
    } else {
        loadFeed();
    }
}

async function handleAuth() {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    const isLogin = document.getElementById('auth-btn').innerText === 'Log In';

    try {
        if (isLogin) {
            await auth.signInWithEmailAndPassword(email, pass);
            window.location.href = 'index.html';
        } else {
            const username = document.getElementById('reg-username').value.toLowerCase();
            const name = document.getElementById('reg-name').value;
            
            const check = await db.collection('users').where('username', '==', username).get();
            if (!check.empty) return alert("Username taken!");

            const res = await auth.createUserWithEmailAndPassword(email, pass);
            await db.collection('users').doc(res.user.uid).set({
                uid: res.user.uid,
                username: username,
                name: name,
                isVerified: false,
                bio: "Digital Nomad",
                profilePic: ""
            });
            window.location.href = 'index.html';
        }
    } catch (e) { alert(e.message); }
}

const regUserInp = document.getElementById('reg-username');
if (regUserInp) {
    regUserInp.addEventListener('input', async (e) => {
        const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
        e.target.value = val;
        const status = document.getElementById('username-status');
        if (val.length < 3) { status.innerHTML = ""; return; }
        const snap = await db.collection('users').where('username', '==', val).get();
        if (!snap.empty) {
            status.innerHTML = `<span class="taken">Username ${val} is taken</span>`;
        } else {
            status.innerHTML = `<span class="available">${val} is available <i class="fas fa-check-circle"></i></span>`;
        }
    });
}

function previewFile() {
    const file = document.getElementById('img-upload' || 'img-file').files[0];
    const preview = document.getElementById('post-preview' || 'image-preview');
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => { preview.src = e.target.result; preview.style.display = 'block'; };
        reader.readAsDataURL(file);
    }
}

async function submitPost() {
    const text = document.getElementById('post-input').value;
    const file = document.getElementById('img-file').files[0];
    if (!text && !file) return;

    let imgUrl = null;
    if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', cloudinaryConfig.uploadPreset);
        
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`, {
            method: 'POST',
            body: formData
        });
        const cloudData = await response.json();
        imgUrl = cloudData.secure_url;
    }

    await db.collection('posts').add({
        text: text,
        imageUrl: imgUrl,
        uid: currentUser.uid,
        username: userData.username,
        isVerified: userData.isVerified,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        likes: []
    });
    location.reload();
}

function loadFeed() {
    const feed = document.getElementById('feed');
    db.collection('posts').orderBy('timestamp', 'desc').onSnapshot(snap => {
        feed.innerHTML = '';
        snap.forEach(doc => renderPost(doc, feed));
    });
}

async function showProfile(username) {
    const view = document.getElementById('profile-view');
    const feed = document.getElementById('feed');
    view.style.display = 'block';
    const snap = await db.collection('users').where('username', '==', username).get();
    if (snap.empty) return;
    const u = snap.docs[0].data();
    document.getElementById('p-username').innerText = `@${u.username}`;
    document.getElementById('p-name').innerText = u.name;
    db.collection('posts').where('username', '==', username).onSnapshot(snap => {
        feed.innerHTML = '';
        snap.forEach(doc => renderPost(doc, feed));
    });
    const msgBtn = document.getElementById('msg-req-btn');
    if (u.uid !== currentUser.uid) {
        msgBtn.style.display = 'block';
        msgBtn.onclick = () => { window.location.href = `chat.html?target=${u.uid}&name=${u.username}`; };
    }
}

function renderPost(doc, container) {
    const data = doc.data();
    const isLiked = data.likes && data.likes.includes(currentUser.uid);
    container.innerHTML += `
        <div class="post-card">
            <div style="font-weight:700; margin-bottom:8px;" onclick="window.location.href='?u=${data.username}'">
                @${data.username} ${data.isVerified ? '<i class="fas fa-check-circle" style="color:#1d9bf0"></i>' : ''}
            </div>
            <div class="post-text">${data.text}</div>
            ${data.imageUrl ? `<img src="${data.imageUrl}" class="post-image">` : ''}
            <div style="margin-top:12px; display:flex; gap:20px; color:#a0a0a0">
                <i class="fa${isLiked ? 's' : 'r'} fa-heart" style="${isLiked ? 'color:#ff0033' : ''}" onclick="toggleLike('${doc.id}', ${isLiked})"></i>
                <span>${data.likes ? data.likes.length : 0}</span>
            </div>
        </div>`;
}

async function toggleLike(postId, isLiked) {
    const ref = db.collection('posts').doc(postId);
    if (isLiked) {
        await ref.update({ likes: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
    } else {
        await ref.update({ likes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
    }
}

function runSearch(query) {
    if (!query) return;
    db.collection('users').where('username', '>=', query.toLowerCase())
      .where('username', '<=', query.toLowerCase() + '\uf8ff')
      .get().then(snap => {
        const container = document.getElementById('results-container');
        container.innerHTML = '';
        snap.forEach(doc => {
            const u = doc.data();
            container.innerHTML += `
                <div class="user-card" onclick="location.href='index.html?u=${u.username}'">
                    <div style="font-weight:700">@${u.username} ${u.isVerified ? '<i class="fas fa-check-circle" style="color:#1d9bf0"></i>' : ''}</div>
                    <button class="follow-btn">View</button>
                </div>`;
        });
    });
}

function loadInbox() {
    const container = document.getElementById('inbox');
    const params = new URLSearchParams(window.location.search);
    const target = params.get('target');
    const name = params.get('name');
    if (target) openChat(target, name);
    db.collection('chats').where('users', 'array-contains', currentUser.uid).onSnapshot(snap => {
        container.innerHTML = '';
        snap.forEach(doc => {
            const data = doc.data();
            const otherUser = data.usernames.find(un => un !== userData.username);
            container.innerHTML += `<div class="chat-item" onclick="openChat('${data.users.find(id => id !== currentUser.uid)}', '${otherUser}')">@${otherUser}</div>`;
        });
    });
}

function openChat(targetUid, targetName) {
    document.getElementById('active-chat').style.display = 'flex';
    document.getElementById('chat-user-name').innerText = `@${targetName}`;
    currentChatId = [currentUser.uid, targetUid].sort().join('_');
    db.collection('chats').doc(currentChatId).set({
        users: [currentUser.uid, targetUid],
        usernames: [userData.username, targetName]
    }, { merge: true });
    db.collection('chats').doc(currentChatId).collection('messages')
      .orderBy('timestamp', 'asc').onSnapshot(snap => {
        const flow = document.getElementById('messages-flow');
        flow.innerHTML = '';
        snap.forEach(doc => {
            const m = doc.data();
            const side = m.senderId === currentUser.uid ? 'sent' : 'received';
            flow.innerHTML += `<div class="msg ${side}">${m.text}</div>`;
        });
        flow.scrollTop = flow.scrollHeight;
    });
}

async function sendMessage() {
    const inp = document.getElementById('msg-input');
    if (!inp.value.trim() || !currentChatId) return;
    await db.collection('chats').doc(currentChatId).collection('messages').add({
        text: inp.value,
        senderId: currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    inp.value = '';
}

function openPostModal() { document.getElementById('post-modal').classList.add('active'); }
function toggleAuth() {
    const sf = document.getElementById('signup-fields');
    const btn = document.getElementById('auth-btn');
    const link = document.querySelector('.toggle-link');
    if (sf.style.display === 'none') {
        sf.style.display = 'block';
        btn.innerText = 'Sign Up';
        link.innerText = 'Already have an account? Log In';
    } else {
        sf.style.display = 'none';
        btn.innerText = 'Log In';
        link.innerText = "Don't have an account? Sign Up";
    }
}