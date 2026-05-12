const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
dotenv.config();

const User = require('../models/User');
const Booth = require('../models/Booth');
const Student = require('../models/Student');
const Candidate = require('../models/Candidate');

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/school_election');
  console.log('✅ Connected to MongoDB');

  // Clear existing
  await Promise.all([
    User.deleteMany({}),
    Booth.deleteMany({}),
    Student.deleteMany({}),
    Candidate.deleteMany({}),
  ]);
  console.log('🧹 Cleared existing data');

  // Create booths
  const booth1 = await Booth.create({ name: 'Booth A', code: 'BOOTHA', location: 'Ground Floor' });
  const booth2 = await Booth.create({ name: 'Booth B', code: 'BOOTHB', location: 'First Floor' });
  const booth3 = await Booth.create({ name: 'Booth C', code: 'BOOTHC', location: 'Second Floor' });
  console.log('🏪 Booths created');

  // Create super admin
  await User.create({
    name: 'Super Admin',
    email: 'admin@election.com',
    password: 'admin123',
    role: 'super_admin',
  });

  // Create booth admins
  await User.create({ name: 'Booth A Admin', email: 'bootha@election.com', password: 'booth123', role: 'booth_admin', boothId: booth1._id });
  await User.create({ name: 'Booth B Admin', email: 'boothb@election.com', password: 'booth123', role: 'booth_admin', boothId: booth2._id });
  await User.create({ name: 'Booth C Admin', email: 'boothc@election.com', password: 'booth123', role: 'booth_admin', boothId: booth3._id });
  console.log('👤 Users created');

  // Create students
  const classes = ['8A', '8B', '9A', '9B', '10A', '10B'];
  const names = ['Arjun Kumar', 'Priya Nair', 'Mohammed Rafi', 'Anjali Menon', 'Rahul Das',
    'Sneha Thomas', 'Arun Krishnan', 'Divya Pillai', 'Vishnu Sharma', 'Lakshmi Devi',
    'Sanjay Patel', 'Rekha Singh', 'Vijay Mohan', 'Pooja Rao', 'Anil Kumar'];

  const booths = [booth1, booth2, booth3];
  const students = [];
  let admNo = 1001;

  for (const cls of classes) {
    for (let i = 0; i < 5; i++) {
      const booth = booths[Math.floor(Math.random() * booths.length)];
      students.push({
        admissionNo: `ADM${admNo++}`,
        name: names[Math.floor(Math.random() * names.length)] + ` (${cls})`,
        class: cls.replace(/[AB]/, ''),
        section: cls.slice(-1),
        boothId: booth._id,
      });
    }
  }
  await Student.insertMany(students);
  console.log(`🎓 ${students.length} students created`);

  // Create candidates
  const schoolCandidates = [
    { name: 'Aditya Sharma', symbol: 'Rising Star', symbolIcon: '🌟', electionType: 'school_leader' },
    { name: 'Meera Pillai', symbol: 'Golden Eagle', symbolIcon: '🦅', electionType: 'school_leader' },
    { name: 'Ravi Kumar', symbol: 'Lotus Bloom', symbolIcon: '🌺', electionType: 'school_leader' },
  ];

  const classCandidates = [];
  const candidateNames = ['Sana Thomas', 'Arjun Nair', 'Priya Das', 'Mohammed Ali', 'Anjali K', 'Rahul V'];
  const candidateIcons = ['⚡', '🦁', '🎯', '🔥', '💎', '🌙'];

  for (const cls of classes) {
    // 2 candidates per class
    for (let i = 0; i < 2; i++) {
      classCandidates.push({
        name: candidateNames[i] + ` (${cls})`,
        symbol: `Team ${cls}`,
        symbolIcon: candidateIcons[i],
        electionType: 'class_leader',
        class: cls // Store as "8A", "8B" etc.
      });
    }
  }

  await Candidate.insertMany([...schoolCandidates, ...classCandidates]);
  console.log(`🏆 ${schoolCandidates.length + classCandidates.length} Candidates created`);

  console.log('\n✅ Seed complete!');
  console.log('📧 Super Admin: admin@election.com / admin123');
  console.log('📧 Booth A Admin: bootha@election.com / booth123');
  console.log('📧 Booth B Admin: boothb@election.com / booth123');
  console.log('📦 Booth A device code: BOOTHA');
  console.log('📦 Booth B device code: BOOTHB');

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
