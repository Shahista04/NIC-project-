const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

// Custom middleware to parse checkbox arrays from form data
app.use((req, res, next) => {
    if (req.body && typeof req.body === 'object') {
        for (let key in req.body) {
            if (typeof req.body[key] === 'string' && (req.body[key].startsWith('[') && req.body[key].endsWith(']'))) {
                try {
                    req.body[key] = JSON.parse(req.body[key]);
                } catch(e) {}
            }
        }
    }
    next();
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        const fs = require('fs');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

// MongoDB Connection String
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/police_feedback_system';

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected successfully to police_feedback_system'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// ==============================================
// SCHEMAS
// ==============================================

// Admin User Schema (for persistent password storage)
const adminUserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Custom Questions Schema
const questionSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    text: { type: String, required: true },
    type: { 
        type: String, 
        enum: ['text', 'textarea', 'rating', 'yesno', 'dropdown', 'date', 'attachment', 'checkbox'],
        default: 'text'
    },
    options: { type: [String], default: [] },
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Feedback Submission Schema
const feedbackSubmissionSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    station_name: { type: String, required: true },
    visit_date: { type: String, required: true },
    reason: { type: String, required: true },
    frequency: { type: String, required: true },
    experience_rating: { type: Number, default: 3, min: 1, max: 5 },
    contact_info: { type: String, default: '' },
    officer_name: { type: String, default: '' },
    officer_rank: { type: String, default: '' },
    time_taken: { type: String, default: '' },
    fir_done: { type: String, default: 'no' },
    suggestions: { type: String, default: '' },
    customAnswers: [{
        questionId: { type: String, required: true },
        question: { type: String, required: true },
        answer: { type: mongoose.Schema.Types.Mixed, required: true },
        type: { type: String, default: 'text' }
    }],
    timestamp: { type: Date, default: Date.now },
    attachments: [{
        filename: { type: String },
        originalName: { type: String },
        mimeType: { type: String },
        size: { type: Number }
    }]
});

// Admin Session Schema
const adminSessionSchema = new mongoose.Schema({
    username: { type: String, required: true },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now }
});

// Create models
const AdminUser = mongoose.models.AdminUser || mongoose.model('AdminUser', adminUserSchema);
const Question = mongoose.models.Question || mongoose.model('Question', questionSchema);
const FeedbackSubmission = mongoose.models.FeedbackSubmission || mongoose.model('FeedbackSubmission', feedbackSubmissionSchema);
const AdminSession = mongoose.models.AdminSession || mongoose.model('AdminSession', adminSessionSchema);

// ==============================================
// INITIALIZE DEFAULT ADMIN USER
// ==============================================
async function initializeDefaultAdmin() {
    try {
        const existingAdmin = await AdminUser.findOne({ username: 'admin' });
        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            const defaultAdmin = new AdminUser({
                username: 'admin',
                password: hashedPassword,
                email: 'admin@example.com'
            });
            await defaultAdmin.save();
            console.log('✅ Default admin user created: admin / admin123');
        } else {
            console.log('✅ Admin user already exists in database');
        }
    } catch (error) {
        console.error('Error initializing admin:', error);
    }
}

// Initialize default questions
async function initializeDefaultQuestions() {
    try {
        const existingQuestions = await Question.countDocuments();
        if (existingQuestions === 0) {
            const defaultQuestions = [
                {
                    id: 'q_001',
                    text: 'Which police station did you visit?',
                    type: 'dropdown',
                    options: ['Central', 'North', 'South', 'East'],
                    active: true
                },
                {
                    id: 'q_002',
                    text: 'What services did you use?',
                    type: 'checkbox',
                    options: ['Complaint Registration', 'Passport Verification', 'Lost Report', 'Other'],
                    active: true
                }
            ];
            await Question.insertMany(defaultQuestions);
            console.log('✅ Default questions created');
        }
    } catch (error) {
        console.error('Error initializing questions:', error);
    }
}

// ==============================================
// DEBUG ENDPOINTS (Added for Python Service)
// ==============================================

// Debug endpoint to check all collections and their data
app.get('/api/debug/database', async (req, res) => {
    try {
        const collections = await mongoose.connection.db.listCollections().toArray();
        
        const result = {
            success: true,
            database: mongoose.connection.name,
            collections: []
        };
        
        for (const collection of collections) {
            const coll = mongoose.connection.db.collection(collection.name);
            const count = await coll.countDocuments();
            
            const collectionInfo = {
                name: collection.name,
                documentCount: count
            };
            
            if (count > 0) {
                const sample = await coll.findOne({});
                if (sample) {
                    // Convert ObjectId to string for display
                    if (sample._id) sample._id = sample._id.toString();
                    // Convert dates to strings
                    if (sample.timestamp) sample.timestamp = sample.timestamp.toISOString();
                    if (sample.createdAt) sample.createdAt = sample.createdAt.toISOString();
                    collectionInfo.sample = sample;
                }
            }
            
            result.collections.push(collectionInfo);
        }
        
        console.log(`📊 Debug: Found ${result.collections.length} collections`);
        res.json(result);
    } catch (error) {
        console.error('Debug error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Debug endpoint specifically for feedback data
app.get('/api/debug/feedback-stats', async (req, res) => {
    try {
        const total = await FeedbackSubmission.countDocuments();
        const allFeedbacks = await FeedbackSubmission.find({}).limit(10).sort({ timestamp: -1 });
        
        // Get unique stations
        const stations = await FeedbackSubmission.distinct('station_name');
        
        // Get date range
        const oldest = await FeedbackSubmission.findOne().sort({ timestamp: 1 });
        const newest = await FeedbackSubmission.findOne().sort({ timestamp: -1 });
        
        res.json({
            success: true,
            total_feedbacks: total,
            unique_stations: stations,
            date_range: {
                oldest: oldest ? oldest.timestamp : null,
                newest: newest ? newest.timestamp : null
            },
            sample_feedbacks: allFeedbacks.map(fb => ({
                id: fb.id,
                station_name: fb.station_name,
                experience_rating: fb.experience_rating,
                reason: fb.reason,
                timestamp: fb.timestamp
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==============================================
// API ROUTES
// ==============================================

// ------------------- Admin Auth API -------------------

// Admin Login
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const admin = await AdminUser.findOne({ username });
        if (!admin) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
        
        const isValidPassword = await bcrypt.compare(password, admin.password);
        if (!isValidPassword) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
        
        const token = crypto.randomBytes(64).toString('hex');
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
        
        const session = new AdminSession({ username, token, expiresAt });
        await session.save();
        await AdminSession.deleteMany({ expiresAt: { $lt: new Date() } });
        
        res.json({ 
            success: true, 
            token, 
            username, 
            expiresAt: expiresAt.getTime() 
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Verify admin token
app.post('/api/admin/verify', async (req, res) => {
    try {
        const { token } = req.body;
        const session = await AdminSession.findOne({ token, expiresAt: { $gt: new Date() } });
        if (session) {
            res.json({ success: true, username: session.username });
        } else {
            res.status(401).json({ success: false, error: 'Invalid or expired token' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin logout
app.post('/api/admin/logout', async (req, res) => {
    try {
        const { token } = req.body;
        await AdminSession.deleteOne({ token });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Verify username for password reset
app.post('/api/admin/verify-username', async (req, res) => {
    try {
        const { username } = req.body;
        
        const admin = await AdminUser.findOne({ username });
        
        if (admin) {
            res.json({ 
                success: true, 
                message: 'Username verified. You can now reset your password.' 
            });
        } else {
            res.status(404).json({ 
                success: false, 
                error: 'Admin username not found. Please contact system administrator.' 
            });
        }
    } catch (error) {
        console.error('Username verification error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reset Password - Direct update after username verification
app.post('/api/admin/reset-password', async (req, res) => {
    try {
        const { username, newPassword } = req.body;
        
        if (!username || !newPassword) {
            return res.status(400).json({ 
                success: false, 
                error: 'Username and new password are required' 
            });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ 
                success: false, 
                error: 'Password must be at least 6 characters long' 
            });
        }
        
        const admin = await AdminUser.findOne({ username });
        if (!admin) {
            return res.status(404).json({ 
                success: false, 
                error: 'Admin user not found' 
            });
        }
        
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        admin.password = hashedPassword;
        admin.updatedAt = new Date();
        await admin.save();
        
        // Clear all existing sessions for this admin
        await AdminSession.deleteMany({ username });
        
        console.log(`✅ Password reset successfully for ${username}`);
        
        res.json({ 
            success: true, 
            message: 'Password has been reset successfully. Please login with your new password.' 
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get admin info
app.get('/api/admin/info', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, error: 'No token provided' });
        }
        
        const session = await AdminSession.findOne({ token, expiresAt: { $gt: new Date() } });
        if (!session) {
            return res.status(401).json({ success: false, error: 'Invalid session' });
        }
        
        res.json({ 
            success: true, 
            username: session.username,
            role: 'Administrator'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ------------------- Questions API -------------------
app.get('/api/questions', async (req, res) => {
    try {
        const questions = await Question.find({ active: true }).sort({ createdAt: 1 });
        res.json({ success: true, questions });
    } catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/admin/questions/all', async (req, res) => {
    try {
        const questions = await Question.find().sort({ createdAt: 1 });
        res.json({ success: true, questions });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/questions', async (req, res) => {
    try {
        const { id, text, type, options, active } = req.body;
        
        if (!id || !text || !type) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        const existingQuestion = await Question.findOne({ id });
        if (existingQuestion) {
            return res.status(409).json({ success: false, error: 'Question with this ID already exists' });
        }
        
        const question = new Question({
            id,
            text,
            type,
            options: options || [],
            active: active !== undefined ? active : true,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        await question.save();
        res.json({ success: true, question });
    } catch (error) {
        console.error('Error creating question:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/admin/questions/:id', async (req, res) => {
    try {
        const { text, type, options, active } = req.body;
        const questionId = req.params.id;
        
        const question = await Question.findOne({ id: questionId });
        if (!question) {
            return res.status(404).json({ success: false, error: 'Question not found' });
        }
        
        if (text !== undefined) question.text = text;
        if (type !== undefined) question.type = type;
        if (options !== undefined) question.options = options;
        if (active !== undefined) question.active = active;
        question.updatedAt = new Date();
        
        await question.save();
        res.json({ success: true, question });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/admin/questions/:id', async (req, res) => {
    try {
        const questionId = req.params.id;
        const result = await Question.deleteOne({ id: questionId });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, error: 'Question not found' });
        }
        
        res.json({ success: true, message: 'Question deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ------------------- Feedback API -------------------
app.post('/api/feedback', upload.array('attachments', 5), async (req, res) => {
    try {
        let feedbackData = req.body;
        
        if (typeof feedbackData.customAnswers === 'string') {
            feedbackData.customAnswers = JSON.parse(feedbackData.customAnswers);
        }
        
        if (feedbackData.customAnswers && Array.isArray(feedbackData.customAnswers)) {
            feedbackData.customAnswers = feedbackData.customAnswers.map(answer => {
                if (typeof answer.answer === 'string' && answer.answer.startsWith('[') && answer.answer.endsWith(']')) {
                    try {
                        answer.answer = JSON.parse(answer.answer);
                    } catch(e) {}
                }
                if (answer.type === 'checkbox' && !Array.isArray(answer.answer)) {
                    answer.answer = answer.answer ? [answer.answer] : [];
                }
                return answer;
            });
        }
        
        if (!feedbackData.id || !feedbackData.station_name || !feedbackData.visit_date) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        const attachments = (req.files || []).map(file => ({
            filename: file.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size
        }));
        
        const feedback = new FeedbackSubmission({
            id: feedbackData.id,
            station_name: feedbackData.station_name,
            visit_date: feedbackData.visit_date,
            reason: feedbackData.reason,
            frequency: feedbackData.frequency,
            experience_rating: feedbackData.experience_rating || 3,
            contact_info: feedbackData.contact_info || '',
            officer_name: feedbackData.officer_name || '',
            officer_rank: feedbackData.officer_rank || '',
            time_taken: feedbackData.time_taken || '',
            fir_done: feedbackData.fir_done || 'no',
            suggestions: feedbackData.suggestions || '',
            customAnswers: feedbackData.customAnswers || [],
            timestamp: new Date(feedbackData.timestamp) || new Date(),
            attachments: attachments
        });
        
        await feedback.save();
        console.log(`✅ Feedback saved: ${feedback.id}`);
        res.json({ success: true, feedback });
    } catch (error) {
        console.error('Error saving feedback:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/feedback', async (req, res) => {
    try {
        const { station, startDate, endDate, minRating, maxRating } = req.query;
        
        let query = {};
        
        if (station) query.station_name = station;
        if (minRating || maxRating) {
            query.experience_rating = {};
            if (minRating) query.experience_rating.$gte = parseInt(minRating);
            if (maxRating) query.experience_rating.$lte = parseInt(maxRating);
        }
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }
        
        const feedbacks = await FeedbackSubmission.find(query).sort({ timestamp: -1 });
        res.json({ success: true, feedbacks });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/feedback/:id', async (req, res) => {
    try {
        const feedback = await FeedbackSubmission.findOne({ id: req.params.id });
        if (!feedback) {
            return res.status(404).json({ success: false, error: 'Feedback not found' });
        }
        res.json({ success: true, feedback });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/feedback/:id', async (req, res) => {
    try {
        const result = await FeedbackSubmission.deleteOne({ id: req.params.id });
        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, error: 'Feedback not found' });
        }
        res.json({ success: true, message: 'Feedback deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/feedback', async (req, res) => {
    try {
        await FeedbackSubmission.deleteMany({});
        res.json({ success: true, message: 'All feedback deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/feedback/stats/summary', async (req, res) => {
    try {
        const total = await FeedbackSubmission.countDocuments();
        const positive = await FeedbackSubmission.countDocuments({ experience_rating: { $gte: 4 } });
        const negative = await FeedbackSubmission.countDocuments({ experience_rating: { $lte: 2 } });
        const neutral = await FeedbackSubmission.countDocuments({ experience_rating: 3 });
        const stationStats = await FeedbackSubmission.aggregate([
            { $group: { _id: '$station_name', count: { $sum: 1 }, avgRating: { $avg: '$experience_rating' } } },
            { $sort: { count: -1 } }
        ]);
        const ratingDistribution = await FeedbackSubmission.aggregate([
            { $group: { _id: '$experience_rating', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);
        res.json({ success: true, stats: { total, positive, negative, neutral, stationStats, ratingDistribution } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==============================================
// SERVE HTML FILES
// ==============================================
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'next_three.html')); });
app.get('/dashboard', (req, res) => { res.sendFile(path.join(__dirname, 'dashboard.html')); });
app.get('/admin', (req, res) => { res.sendFile(path.join(__dirname, 'admin.html')); });

// ==============================================
// START SERVER
// ==============================================
async function startServer() {
    await initializeDefaultAdmin();
    await initializeDefaultQuestions();
    
    app.listen(PORT, () => {
        console.log(`\n🚀 Server running on http://localhost:${PORT}`);
        console.log(`   - Citizen Form: http://localhost:${PORT}/`);
        console.log(`   - Admin Dashboard: http://localhost:${PORT}/dashboard`);
        console.log(`   - Admin Login: http://localhost:${PORT}/admin`);
        console.log(`   - MongoDB: ${MONGODB_URI}`);
        console.log(`\n📝 Default Admin Credentials:`);
        console.log(`   Username: admin`);
        console.log(`   Password: `);
        console.log(`\n🔐 Passwords are stored securely in MongoDB with bcrypt hashing\n`);
        console.log(`🔍 Debug Endpoints:`);
        console.log(`   - Database Info: http://localhost:${PORT}/api/debug/database`);
        console.log(`   - Feedback Stats: http://localhost:${PORT}/api/debug/feedback-stats`);
    });
}

startServer();