const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect('mongodb://127.0.0.1:27017/attendanceTracker', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB Connected'))
.catch(err => console.error(err));

const UserSchema = new mongoose.Schema({ 
    name: String,
    timetableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Timetable' }
});

const TimetableSchema = new mongoose.Schema({
    userId: String,
    schedule: {
        Monday: [String],
        Tuesday: [String],
        Wednesday: [String],
        Thursday: [String],
        Friday: [String],
        Saturday: [String],
        Sunday: [String],
    }
});

const AttendanceSchema = new mongoose.Schema({
    userId: String,
    date: String,
    subjects: Object,
    startDate: String
});

const User = mongoose.model('User', UserSchema);
const Timetable = mongoose.model('Timetable', TimetableSchema);
const Attendance = mongoose.model('Attendance', AttendanceSchema);

// Get all users
app.get('/users', async (req, res) => {
    const users = await User.find();
    res.json(users);
});

// Add a new user
// Add a new user
app.post('/users', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const user = new User({ name });
    await user.save();

    // Add default timetable for the user
    const defaultTimetable = {
        userId: user._id.toString(),
        schedule: {
            Monday: ['operating systems', 'UHV', 'maths', 'java lab'],
            Tuesday: ['java', 'maths', 'operating systems', 'ARM', 'os lab'],
            Wednesday: ['operating systems', 'maths', 'ARM', 'java', 'ARM lab'],
            Thursday: ['maths', 'c++ lab', 'c++', 'ARM', 'java'],
            Friday: ['UI/UX lab', 'operating systems', 'java', 'ARM', 'c++'],
        }
    };

    const timetable = new Timetable(defaultTimetable);
    await timetable.save();

    res.json(user);
});


// Get attendance for a specific user
app.get('/attendance/:userId', async (req, res) => {
    const { userId } = req.params;
    const attendance = await Attendance.find({ userId });
    
    const formattedAttendance = {};
    attendance.forEach(entry => {
        formattedAttendance[entry.date] = entry.subjects;
    });

    res.json(formattedAttendance);
});

// Update or create attendance record
app.post('/attendance', async (req, res) => {
    const { userId, date, subjects, startDate } = req.body;

    const utcDate = new Date(date).toISOString().split('T')[0];
    const dayOfWeek = new Date(utcDate).getUTCDay(); // Ensure correct weekday calculation

    console.log("🔹 Incoming Attendance Update:");
    console.log("  - User ID:", userId);
    console.log("  - Date (UTC):", utcDate);
    console.log("  - Day of the Week:", dayOfWeek);
    console.log("  - Subjects:", subjects);
    console.log("  - Start Date:", startDate);

    // Prevent attendance marking for weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        return res.json({ message: 'Attendance cannot be marked for weekends' });
    }

    let attendance = await Attendance.findOne({ userId, date: utcDate });

    if (attendance) {
        console.log("🔄 Updating existing attendance record");
        attendance.subjects = subjects;
        attendance.startDate = startDate;
    } else {
        console.log("🆕 Creating new attendance record");
        attendance = new Attendance({ userId, date: utcDate, subjects, startDate });
    }

    await attendance.save();
    console.log("✅ Attendance successfully updated in DB");

    res.json({ message: 'Attendance updated successfully', attendance });
});




// Get attendance percentage
app.get('/attendance/:userId/percentage', async (req, res) => {
    const { userId } = req.params;
    let { startDate } = req.query;

    if (!startDate) {
        const firstRecord = await Attendance.findOne({ userId }).sort({ date: 1 });
        startDate = firstRecord ? firstRecord.startDate : new Date(0).toISOString().split('T')[0];
    }

    const today = new Date().toISOString().split('T')[0];

    try {
        const attendanceRecords = await Attendance.find({
            userId,
            date: { $gte: startDate, $lte: today }
        });

        let currentDate = new Date(startDate);
        const endDate = new Date(today);
        const allDates = new Set();

        // Collect valid weekdays (Monday to Friday)
        // Collect valid weekdays (Monday to Friday) in UTC
while (currentDate <= endDate) {
    const currentDateString = currentDate.toISOString().split('T')[0];
    const dayOfWeek = currentDate.getUTCDay(); // Use getUTCDay for consistent weekday calculation
    if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Monday (1) to Friday (5)
        allDates.add(currentDateString);
    }
    currentDate.setDate(currentDate.getDate() + 1);
}


        const timetable = await Timetable.findOne({ userId });
        if (!timetable) {
            return res.status(404).json({ error: 'Timetable not found for the user' });
        }

        // Map attendance records to subjects
        const subjectDays = attendanceRecords.reduce((acc, record) => {
            Object.keys(record.subjects).forEach(subject => {
                if (record.subjects[subject]) {
                    acc[subject] = acc[subject] || [];
                    acc[subject].push(record.date);
                }
            });
            return acc;
        }, {});

        const subjectPercentages = {};
        Object.keys(timetable.schedule).forEach(day => {
            const subjects = timetable.schedule[day];
            subjects.forEach(subject => {
                if (!subjectPercentages[subject]) {
                    const scheduledDays = Array.from(allDates).filter(date => {
                        const dayName = new Date(date).toLocaleString('en-US', { weekday: 'long' });
                        return timetable.schedule[dayName] && timetable.schedule[dayName].includes(subject);
                    }).length;

                    const attendedDays = subjectDays[subject]?.length || 0;
                    subjectPercentages[subject] = scheduledDays > 0 
                        ? ((attendedDays / scheduledDays) * 100).toFixed(2)
                        : "0.00";
                }
            });
        });

        res.json(subjectPercentages);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error while calculating percentages' });
    }
});



// Add or update subjects for a specific day
app.post('/timetable/:userId/:day', async (req, res) => {
    const { userId, day } = req.params;
    const { subjects } = req.body;

    let timetable = await Timetable.findOne({ userId });

    if (timetable) {
        timetable.schedule[day] = subjects;
    } else {
        timetable = new Timetable({ userId, schedule: { [day]: subjects } });
    }

    await timetable.save();
    res.json({ message: 'Timetable updated successfully', timetable });
});

// Get timetable for a user
app.get('/timetable/:userId', async (req, res) => {
    const { userId } = req.params;
    const timetable = await Timetable.findOne({ userId });
    res.json(timetable ? timetable.schedule : {});
});

// Delete a user and their related data
app.delete('/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await User.findByIdAndDelete(id);
        await Attendance.deleteMany({ userId: id });
        await Timetable.deleteMany({ userId: id });
        res.json({ message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting user' });
    }
});

app.listen(5000, () => console.log('Server running on port 5000'));
