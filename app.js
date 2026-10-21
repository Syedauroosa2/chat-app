import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    updateProfile, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    orderBy, 
    onSnapshot, 
    serverTimestamp,
    doc,
    updateDoc,
    arrayUnion
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyBCxJcg4CAfosmbaxKOScvpEBN-qOSPOus",
    authDomain: "chat-application-adc83.firebaseapp.com",
    projectId: "chat-application-adc83",
    storageBucket: "chat-application-adc83.firebasestorage.app",
    messagingSenderId: "894720031152",
    appId: "1:894720031152:web:1f2f70bec40c4424333e75",
    measurementId: "G-R8K95327ZY"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const isAuthPage = !!document.getElementById('authForm');
const isChatPage = !!document.getElementById('messageForm');

// ==========================================
// 🔑 AUTHENTICATION LOGIC (index.html)
// ==========================================
if (isAuthPage) {
    let isSignUpState = false;
    const authForm = document.getElementById('authForm');
    const authTitle = document.getElementById('authTitle');
    const authSubtitle = document.getElementById('authSubtitle');
    const submitBtn = document.getElementById('submitBtn');
    const toggleAuth = document.getElementById('toggleAuth');
    const toggleMsg = document.getElementById('toggleMsg');
    const usernameInput = document.getElementById('username');

    toggleAuth.addEventListener('click', (e) => {
        e.preventDefault();
        isSignUpState = !isSignUpState;
        if (isSignUpState) {
            authTitle.innerText = "Create an Account";
            authSubtitle.innerText = "Sign up to start chatting";
            submitBtn.innerText = "Sign Up";
            usernameInput.style.display = "block";
            usernameInput.setAttribute('required', 'true');
            toggleMsg.innerText = "Already have an account?";
            toggleAuth.innerText = "Login";
        } else {
            authTitle.innerText = "Welcome to NexusChat";
            authSubtitle.innerText = "Login to continue chatting";
            submitBtn.innerText = "Login";
            usernameInput.style.display = "none";
            usernameInput.removeAttribute('required');
            toggleMsg.innerText = "Don't have an account?";
            toggleAuth.innerText = "Sign Up";
        }
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            if (isSignUpState) {
                const name = usernameInput.value;
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, { displayName: name });
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
            window.location.href = "chat.html";
        } catch (error) {
            alert(error.message);
        }
    });
}

// ==========================================
// 💬 CHAT LOGIC (chat.html)
// ==========================================
if (isChatPage) {
    const messageForm = document.getElementById('messageForm');
    const messageInput = document.getElementById('messageInput');
    const chatMessages = document.getElementById('chatMessages');
    const logoutBtn = document.getElementById('logoutBtn');
    const currentUserName = document.getElementById('currentUserName');
    const currentUserAvatar = document.getElementById('currentUserAvatar');
    const currentUserImg = document.getElementById('currentUserImg');
    
    // Profile Modal Elements
    const editProfileBtn = document.getElementById('editProfileBtn');
    const profileModal = document.getElementById('profileModal');
    const profileFileInput = document.getElementById('profileFileInput');
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const uploadStatus = document.getElementById('uploadStatus');

    // Voice Recording Elements
    const micBtn = document.getElementById('micBtn');
    const micIcon = document.getElementById('micIcon');
    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;

    let currentUser = null;

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            const name = user.displayName || user.email.split('@')[0];
            currentUserName.innerText = name;

            if (user.photoURL) {
                currentUserImg.src = user.photoURL;
                currentUserImg.style.display = 'block';
                currentUserAvatar.style.display = 'none';
            } else {
                currentUserAvatar.innerText = name.charAt(0).toUpperCase();
                currentUserAvatar.style.display = 'flex';
                currentUserImg.style.display = 'none';
            }

            listenToMessages();
        } else {
            window.location.href = "index.html";
        }
    });

    // Profile Modal Handlers
    editProfileBtn.addEventListener('click', () => {
        profileFileInput.value = '';
        uploadStatus.style.display = 'none';
        profileModal.style.display = 'flex';
    });

    closeModalBtn.addEventListener('click', () => {
        profileModal.style.display = 'none';
    });

    saveProfileBtn.addEventListener('click', async () => {
        const file = profileFileInput.files[0];
        if (!file) {
            alert("Please select an image file first!");
            return;
        }

        try {
            uploadStatus.innerText = "Uploading image...";
            uploadStatus.style.display = "block";
            saveProfileBtn.disabled = true;

            const storageRef = ref(storage, `profile_pictures/${currentUser.uid}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            await updateProfile(currentUser, { photoURL: downloadURL });

            currentUserImg.src = downloadURL;
            currentUserImg.style.display = 'block';
            currentUserAvatar.style.display = 'none';

            uploadStatus.innerText = "Uploaded successfully!";
            setTimeout(() => {
                profileModal.style.display = 'none';
                saveProfileBtn.disabled = false;
            }, 1000);

        } catch (e) {
            console.error("Storage error:", e);
            uploadStatus.innerText = "Upload failed: " + e.message;
            saveProfileBtn.disabled = false;
        }
    });

    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => { window.location.href = "index.html"; });
    });

    // Voice Recording Logic
    micBtn.addEventListener('click', async () => {
        if (!isRecording) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];

                mediaRecorder.ondataavailable = (event) => {
                    audioChunks.push(event.data);
                };

                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    await sendVoiceMessage(audioBlob);
                };

                mediaRecorder.start();
                isRecording = true;
                micBtn.classList.add('recording');
                micIcon.classList.remove('fa-microphone');
                micIcon.classList.add('fa-stop');
            } catch (err) {
                alert("Microphone access denied or not available!");
                console.error(err);
            }
        } else {
            mediaRecorder.stop();
            isRecording = false;
            micBtn.classList.remove('recording');
            micIcon.classList.remove('fa-stop');
            micIcon.classList.add('fa-microphone');
        }
    });

    async function sendVoiceMessage(blob) {
        try {
            const audioId = Date.now();
            const storageRef = ref(storage, `voice_notes/${currentUser.uid}_${audioId}.webm`);
            
            await uploadBytes(storageRef, blob);
            const audioUrl = await getDownloadURL(storageRef);

            await addDoc(collection(db, "global_messages"), {
                type: "audio",
                audioUrl: audioUrl,
                senderId: currentUser.uid,
                senderName: currentUser.displayName || currentUser.email.split('@')[0],
                createdAt: serverTimestamp(),
                reaction: "",
                isDeleted: false,
                deletedFor: []
            });
        } catch (e) {
            console.error("Error sending voice note:", e);
        }
    }

    // Send Text Message
    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = messageInput.value.trim();
        if (!text) return;

        try {
            await addDoc(collection(db, "global_messages"), {
                type: "text",
                text: text,
                senderId: currentUser.uid,
                senderName: currentUser.displayName || currentUser.email.split('@')[0],
                createdAt: serverTimestamp(),
                reaction: "",
                isDeleted: false,
                deletedFor: []
            });
            messageInput.value = "";
        } catch (err) {
            console.error("Error sending message: ", err);
        }
    });

    function listenToMessages() {
        const q = query(collection(db, "global_messages"), orderBy("createdAt", "asc"));

        onSnapshot(q, (snapshot) => {
            chatMessages.innerHTML = "";
            snapshot.forEach((docSnapshot) => {
                renderSingleMessage(docSnapshot.id, docSnapshot.data());
            });
            chatMessages.scrollTop = chatMessages.scrollHeight;
        });
    }

    function renderSingleMessage(id, data) {
        if (data.deletedFor && data.deletedFor.includes(currentUser.uid)) return;

        const isMe = data.senderId === currentUser.uid;
        const wrapperDiv = document.createElement('div');
        wrapperDiv.classList.add('message-wrapper', isMe ? 'sent' : 'received');

        const messageMenu = document.createElement('div');
        messageMenu.classList.add('message-menu');
        messageMenu.style.display = 'none';

        if (!data.isDeleted) {
            const reactionPicker = document.createElement('div');
            reactionPicker.classList.add('reaction-picker');

            ['❤️', '👍', '😂', '🔥', '😮'].forEach((emoji) => {
                const emojiSpan = document.createElement('span');
                emojiSpan.innerText = emoji;
                emojiSpan.addEventListener('click', () => {
                    reactToMessage(id, emoji);
                    messageMenu.style.display = 'none';
                });
                reactionPicker.appendChild(emojiSpan);
            });
            messageMenu.appendChild(reactionPicker);
        }

        const deleteOptions = document.createElement('div');
        deleteOptions.classList.add('delete-options');

        const deleteForMeBtn = document.createElement('button');
        deleteForMeBtn.classList.add('delete-btn');
        deleteForMeBtn.innerHTML = '<i class="fa-solid fa-trash"></i> For Me';
        deleteForMeBtn.addEventListener('click', () => deleteForMe(id));
        deleteOptions.appendChild(deleteForMeBtn);

        if (isMe && !data.isDeleted) {
            const deleteEveryoneBtn = document.createElement('button');
            deleteEveryoneBtn.classList.add('delete-btn');
            deleteEveryoneBtn.innerHTML = '<i class="fa-solid fa-ban"></i> Everyone';
            deleteEveryoneBtn.addEventListener('click', () => deleteForEveryone(id));
            deleteOptions.appendChild(deleteEveryoneBtn);
        }
        messageMenu.appendChild(deleteOptions);

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        if (data.isDeleted) messageDiv.classList.add('is-deleted');

        const senderSpan = document.createElement('small');
        senderSpan.classList.add('message-sender');
        senderSpan.innerText = isMe ? 'You' : data.senderName;
        messageDiv.appendChild(senderSpan);

        if (data.isDeleted) {
            const textPara = document.createElement('p');
            textPara.innerText = "🚫 This message was deleted";
            messageDiv.appendChild(textPara);
        } else if (data.type === "audio") {
            const audioElem = document.createElement('audio');
            audioElem.controls = true;
            audioElem.src = data.audioUrl;
            messageDiv.appendChild(audioElem);
        } else {
            const textPara = document.createElement('p');
            textPara.innerText = data.text;
            messageDiv.appendChild(textPara);
        }

        if (data.reaction && !data.isDeleted) {
            const reactionBadge = document.createElement('span');
            reactionBadge.classList.add('reaction-badge');
            reactionBadge.innerText = data.reaction;
            messageDiv.appendChild(reactionBadge);
        }

        messageDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = messageMenu.style.display === 'flex';
            document.querySelectorAll('.message-menu').forEach(m => m.style.display = 'none');
            messageMenu.style.display = isVisible ? 'none' : 'flex';
        });

        wrapperDiv.appendChild(messageMenu);
        wrapperDiv.appendChild(messageDiv);
        chatMessages.appendChild(wrapperDiv);
    }

    async function reactToMessage(docId, emoji) {
        try {
            const messageRef = doc(db, "global_messages", docId);
            await updateDoc(messageRef, { reaction: emoji });
        } catch (e) { console.error(e); }
    }

    async function deleteForEveryone(docId) {
        try {
            const messageRef = doc(db, "global_messages", docId);
            await updateDoc(messageRef, { isDeleted: true, text: "This message was deleted", reaction: "", type: "text" });
        } catch (e) { console.error(e); }
    }

    async function deleteForMe(docId) {
        try {
            const messageRef = doc(db, "global_messages", docId);
            await updateDoc(messageRef, { deletedFor: arrayUnion(currentUser.uid) });
        } catch (e) { console.error(e); }
    }

    document.addEventListener('click', () => {
        document.querySelectorAll('.message-menu').forEach(m => m.style.display = 'none');
    });
}