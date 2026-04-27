const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    station_name: { type: String, required: true, trim: true },
    visit_date: { type: Date, required: true },
    reason: { type: String, default: '' },
    visit_count: { type: String, default: '' },
    seating: { type: String, default: '' },
    water: { type: String, default: '' },
    officer_rank: { type: String, default: '' },
    officer_name: { type: String, default: '' },
    behavior: { type: String, default: '' },
    time_taken: { type: String, default: '' },
    receipt: { type: String, default: '' },
    fir_done: { type: String, default: '' },
    fir_visits: { type: String, default: '' },
    fir_correct: { type: String, default: '' },
    bribe: { type: String, default: '' },
    improvement: [{ type: String }],
    suggestions: { type: String, default: '' },
    experience_rating: { type: Number, required: true, min: 1, max: 5 },
    contact_info: { type: String, default: '' },
    call_permission: { type: String, default: '' },
    feedback_id: { type: String, unique: true },
    status: { type: String, default: 'pending', enum: ['pending', 'reviewed', 'action_taken'] },
    ip_address: { type: String },
    user_agent: { type: String }
}, {
    timestamps: true
});

feedbackSchema.pre('save', function(next) {
    if (!this.feedback_id) {
        this.feedback_id = 'FB_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    next();
});

module.exports = mongoose.model('Feedback', feedbackSchema);