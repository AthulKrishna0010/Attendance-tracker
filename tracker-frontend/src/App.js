import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './App.css';

const API_URL = 'http://localhost:5000';

function App() {
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [date, setDate] = useState(new Date());
    const [attendance, setAttendance] = useState({});
    const [newUserName, setNewUserName] = useState("");
    const [subjectPercentages, setSubjectPercentages] = useState({});
    const [startDate, setStartDate] = useState(localStorage.getItem('startDate') || new Date().toISOString().split('T')[0]);
    const [selectedDaySubjects, setSelectedDaySubjects] = useState([]);
    const [errorMessage, setErrorMessage] = useState("");

    const timetable = {
        Monday: ['operating systems', 'UHV', 'maths', 'java lab'],
        Tuesday: ['java', 'maths', 'operating systems', 'ARM', 'os lab'],
        Wednesday: ['operating systems', 'maths', 'ARM', 'java', 'ARM lab'],
        Thursday: ['maths', 'c++ lab', 'c++', 'ARM', 'java'],
        Friday: ['UI/UX lab', 'operating systems', 'java', 'ARM', 'c++'],
    };

    useEffect(() => {
        axios.get(`${API_URL}/users`).then(response => setUsers(response.data));
    }, []);

    useEffect(() => {
        if (selectedUser) {
            axios.get(`${API_URL}/attendance/${selectedUser}`)
                .then(response => setAttendance(response.data))
                .catch(err => console.error("Error fetching attendance:", err));

            axios.get(`${API_URL}/attendance/${selectedUser}/percentage?startDate=${startDate}`)
                .then(response => setSubjectPercentages(response.data))
                .catch(err => console.error("Error fetching percentages:", err));
        }
    }, [selectedUser, date, startDate]);

    useEffect(() => {
        if (selectedUser && date) {
            const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
            setSelectedDaySubjects(timetable[dayOfWeek] || []);
        }
    }, [selectedUser, date]);

    const handleAttendanceUpdate = (subject) => {
        const formattedDate = date.getFullYear() + '-' 
                    + String(date.getMonth() + 1).padStart(2, '0') + '-' 
                    + String(date.getDate()).padStart(2, '0');

    
        // Get the selected date **without timezone shifts**
        const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const dayOfWeek = localDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
        console.log("Selected Date (Local):", localDate.toDateString());
        console.log("Formatted Date (ISO):", formattedDate);
        console.log("Day of the Week (Local):", dayOfWeek);
    
        if (localDate.getTime() > new Date().getTime()) {
            setErrorMessage("You cannot mark attendance for future dates.");
            return;
        }
    
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            setErrorMessage("Warning: You are marking attendance for a weekend.");
        } else {
            setErrorMessage(""); // Clear error if it's a weekday
        }
    
        const updatedAttendance = {
            ...attendance,
            [formattedDate]: {
                ...attendance[formattedDate],
                [subject]: !attendance[formattedDate]?.[subject]
            }
        };
    
        setAttendance(updatedAttendance);
        console.log("Final Date Sent to Backend:", formattedDate);
console.log("Day of the Week (Local):", date.getDay()); // Should be 1 for Monday

        axios.post(`${API_URL}/attendance`, {
            userId: selectedUser,
            date: formattedDate,
            subjects: updatedAttendance[formattedDate],
            startDate: startDate
        }).then(() => {
            axios.get(`${API_URL}/attendance/${selectedUser}/percentage?startDate=${startDate}`)
                .then(response => setSubjectPercentages(response.data));
        });
    };
    

    const handleAddUser = () => {
        if (!newUserName.trim()) return;
        axios.post(`${API_URL}/users`, { name: newUserName }).then(response => {
            setUsers([...users, response.data]);
            setNewUserName("");
        });
    };

    const handleDeleteUser = (userId) => {
        axios.delete(`${API_URL}/users/${userId}`).then(() => {
            setUsers(users.filter(user => user._id !== userId));
            if (selectedUser === userId) {
                setSelectedUser(null);
            }
        });
    };

    const handleStartDateChange = (e) => {
        const newStartDate = e.target.value;
        setStartDate(newStartDate);
        localStorage.setItem('startDate', newStartDate);
    };

    const handleDateChange = (date) => {
        setDate(date);
        setErrorMessage("");
    };

    return (
        <div className="App">
            <h1>Attendance Tracker</h1>

            <div>
                <input 
                    type="text" 
                    placeholder="Enter new user name" 
                    value={newUserName} 
                    onChange={(e) => setNewUserName(e.target.value)} 
                />
                <button onClick={handleAddUser}>Add User</button>
            </div>

            <div className="user-list">
                {users.map(user => (
                    <div key={user._id} className="user-item">
                        <button onClick={() => setSelectedUser(user._id)}>
                            {user.name}
                        </button>
                        <button 
                            onClick={() => handleDeleteUser(user._id)} 
                            className="delete-button"
                        >
                            ❌
                        </button>
                    </div>
                ))}
            </div>

            <Calendar onChange={handleDateChange} value={date} tileDisabled={({ date }) => date.getDay() === 0 || date.getDay() === 6} />

            <div>
                <label>Start Date for Percentage Calculation: </label>
                <input 
                    type="date" 
                    value={startDate} 
                    onChange={handleStartDateChange} 
                />
            </div>

            {errorMessage && <p className="error-message">{errorMessage}</p>}

            {selectedUser && selectedDaySubjects.length > 0 && (
                <div>
                    <h3>Mark Attendance for {date.toDateString()}</h3>
                    {selectedDaySubjects.map(subject => {
                        const formattedDate = date.toISOString().split('T')[0];

                        return (
                            <div key={subject} className="subject-row">
                                <input
                                    type="checkbox"
                                    checked={attendance[formattedDate]?.[subject] || false}
                                    onChange={() => handleAttendanceUpdate(subject)}
                                    className="attendance-checkbox"
                                />
                                <span className="subject-name">{subject}</span>
                                <span className="subject-percentage">{subjectPercentages[subject] ? `${subjectPercentages[subject]}%` : "0%"}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default App;
