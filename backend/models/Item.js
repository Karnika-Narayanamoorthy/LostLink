const mongoose = require('mongoose');

const CAMPUS_LOCATIONS = [
  'Gate 01', 'Gate 02', 'Gate 03', 'Gate 04', 'Gate 05', 'Gate 06', 'Gate 07',
  'Unity Junction', 'CV Raman Square',
  'Chanakya Block', 'Aryabhatta Block', 'Bhaskara Block',
  'Sanskriti Auditorium',
  'Thiruvalluvar Hostel', 'Cholan Hostel', 'Pandian Hostel', 'Pallavan Hostel',
  'Bharathi Hostel', 'Cheran Hostel', 'Vivekanandha Hostel',
  'Ganga Hostel', 'Yamuna Hostel', 'Kaveri Hostel',
  'Mythreyi Block', 'Central Park', 'Phoenix Circle',
  'KPR Sports Complex', 'Fitness Studio', 'Olive Dining',
  'Pavilion', 'Lake View Parking', 'Mahogany Parking',
  'Aero Zone', 'Racing Bay'
];

const CATEGORIES = ['electronics', 'bags', 'documents', 'accessories', 'clothing', 'other'];

const itemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Item title is required'],
    trim: true,
    maxlength: [150, 'Title cannot exceed 150 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: CATEGORIES,
    lowercase: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
    default: ''
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  type: {
    type: String,
    required: [true, 'Item type is required'],
    enum: ['lost', 'found']
  },

  // Date the item was lost/found (user-specified)
  incidentDate: {
    type: Date,
    default: Date.now
  },

  // Private field – shown only to admin and the reporter
  verificationCharacteristic: {
    type: String,
    trim: true,
    default: '',
    select: false
  },

  image: {
    type: String,  // path to uploaded file
    default: ''
  },

  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // ── Admin-controlled status ──────────────────────────────────────────────
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'returned', 'cancelled'],
    default: 'pending'
  },

  adminNote: {
    type: String,
    default: ''
  },

  approvedAt: Date,
  returnedAt: Date,
  rejectedAt: Date,

  // ── Matching / notifications ─────────────────────────────────────────────
  notificationSent: {
    type: Boolean,
    default: false
  },

  // Finder reward tracking
  rewardApprovalGranted: {
    type: Boolean,
    default: false
  },
  rewardReturnGranted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// ── Indexes ──────────────────────────────────────────────────────────────────
itemSchema.index({ type: 1, status: 1, incidentDate: -1 });
itemSchema.index({ reportedBy: 1 });
itemSchema.index({ category: 1, location: 1 });

module.exports = mongoose.model('Item', itemSchema);
module.exports.CAMPUS_LOCATIONS = CAMPUS_LOCATIONS;
module.exports.CATEGORIES = CATEGORIES;
