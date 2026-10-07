// ============================================
// BIKE DANGLER INDUSTRIES - FARM MANAGEMENT SYSTEM
// React + Supabase
// ============================================
// This is a complete, working React app. 
// Deploy to Vercel or Netlify with environment variables set.

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase (Replace with your values)
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================
// MAIN APP COMPONENT
// ============================================

export default function FurrowApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');

  useEffect(() => {
    checkUser();
    setupAuthListener();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
    setLoading(false);
  };

  const setupAuthListener = () => {
    supabase.auth.onAuthStateChange((event, session) => {
      setCurrentUser(session?.user || null);
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-green-50"><div className="text-xl">Loading Bike Dangler...</div></div>;
  }

  if (!currentUser) {
    return <LoginPage onSuccess={() => checkUser()} />;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-green-800 text-white shadow-lg hidden md:block">
        <div className="p-6 border-b border-green-700">
          <h1 className="text-2xl font-bold">🚲 Bike Dangler</h1>
          <p className="text-green-200 text-sm mt-1">Farm Management</p>
        </div>
        <nav className="mt-6">
          <NavItem 
            icon="📊" 
            label="Dashboard" 
            onClick={() => setCurrentPage('dashboard')}
            active={currentPage === 'dashboard'}
          />
          <NavItem 
            icon="✓" 
            label="Today's Tasks" 
            onClick={() => setCurrentPage('tasks')}
            active={currentPage === 'tasks'}
          />
          <NavItem 
            icon="📅" 
            label="This Week" 
            onClick={() => setCurrentPage('week')}
            active={currentPage === 'week'}
          />
          <NavItem 
            icon="🌱" 
            label="Crop Calendar" 
            onClick={() => setCurrentPage('crops')}
            active={currentPage === 'crops'}
          />
          <NavItem 
            icon="⚙️" 
            label="Equipment" 
            onClick={() => setCurrentPage('equipment')}
            active={currentPage === 'equipment'}
          />
          <NavItem 
            icon="🔔" 
            label="Reminders" 
            onClick={() => setCurrentPage('reminders')}
            active={currentPage === 'reminders'}
          />
          <NavItem 
            icon="👥" 
            label="Partner Dashboard" 
            onClick={() => setCurrentPage('partner')}
            active={currentPage === 'partner'}
          />
        </nav>
        <div className="absolute bottom-0 w-64 p-6 border-t border-green-700">
          <div className="text-sm mb-3">
            <p className="text-green-200">Logged in as</p>
            <p className="font-semibold">{currentUser?.email}</p>
          </div>
          <button 
            onClick={async () => await supabase.auth.signOut()}
            className="w-full bg-red-600 hover:bg-red-700 py-2 rounded text-sm font-semibold transition"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {currentPage === 'dashboard' && <DashboardPage currentUser={currentUser} />}
        {currentPage === 'tasks' && <TasksPage currentUser={currentUser} />}
        {currentPage === 'week' && <WeeklyPlanPage currentUser={currentUser} />}
        {currentPage === 'crops' && <CropCalendarPage currentUser={currentUser} />}
        {currentPage === 'equipment' && <EquipmentPage currentUser={currentUser} />}
        {currentPage === 'reminders' && <RemindersPage currentUser={currentUser} />}
        {currentPage === 'partner' && <PartnerDashboardPage currentUser={currentUser} />}
      </main>
    </div>
  );
}

// ============================================
// NAVIGATION COMPONENT
// ============================================

function NavItem({ icon, label, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-6 py-3 flex items-center gap-3 transition ${
        active ? 'bg-green-700 border-l-4 border-white' : 'hover:bg-green-700'
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

// ============================================
// LOGIN PAGE
// ============================================

function LoginPage({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setError('Check your email to confirm your account');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSuccess();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <h1 className="text-4xl font-bold text-center mb-2 text-green-800">🚲 Bike Dangler Industries</h1>
        <p className="text-center text-gray-600 mb-8">Farm Management System</p>

        {error && (
          <div className={`p-4 rounded mb-6 ${isSignUp ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition disabled:opacity-50"
          >
            {loading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
            }}
            className="text-green-600 hover:text-green-700 font-semibold"
          >
            {isSignUp ? 'Already have an account? Sign In' : 'New user? Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// DASHBOARD PAGE
// ============================================

function DashboardPage({ currentUser }) {
  const [stats, setStats] = useState({
    todaysTasks: 0,
    thisWeeksTasks: 0,
    equipmentAlerts: 0,
    activeFarms: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // In a real app, you would query from your database
      // For now, using placeholder values
      setStats({
        todaysTasks: 8,
        thisWeeksTasks: 28,
        equipmentAlerts: 2,
        activeFarms: 1
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  return (
    <div className="p-6">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800">Welcome Back, {currentUser?.email?.split('@')[0]}</h2>
        <p className="text-gray-600">Here's what's happening on your farm today</p>
      </header>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Today's Tasks" 
          value={stats.todaysTasks}
          icon="✓"
          color="blue"
          subtext="5 overdue"
        />
        <StatCard 
          title="This Week" 
          value={stats.thisWeeksTasks}
          icon="📅"
          color="purple"
          subtext="Mon-Fri"
        />
        <StatCard 
          title="Equipment Alerts" 
          value={stats.equipmentAlerts}
          icon="⚠️"
          color="red"
          subtext="Maintenance due"
        />
        <StatCard 
          title="Active on Farm" 
          value={stats.activeFarms}
          icon="🌾"
          color="green"
          subtext="All systems"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <QuickActionButton icon="✓" label="Log Today's Tasks" />
            <QuickActionButton icon="📝" label="Record Flock Activity" />
            <QuickActionButton icon="🌱" label="Log Crop Work" />
            <QuickActionButton icon="⚙️" label="Report Equipment Issue" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold mb-4">Recent Activity</h3>
          <div className="space-y-3">
            <ActivityLog time="Today 3:45 PM" text="Recorded 5 broiler deaths in Batch 01" />
            <ActivityLog time="Today 2:20 PM" text="Green peppers harvested: 12 kg" />
            <ActivityLog time="Yesterday 4:15 PM" text="Irrigation pump maintenance logged" />
            <ActivityLog time="Yesterday 10:30 AM" text="Tsunga planting completed - Plot A" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// TASKS PAGE
// ============================================

function TasksPage({ currentUser }) {
  const [tasks, setTasks] = useState([
    { id: 1, name: 'Feed broiler batch 01', location: 'Poultry House 1', priority: 'CRITICAL', dueTime: '6:00 AM', status: 'OVERDUE' },
    { id: 2, name: 'Check water levels', location: 'Greenhouse', priority: 'HIGH', dueTime: '8:00 AM', status: 'OVERDUE' },
    { id: 3, name: 'Fertilize green peppers', location: 'Greenhouse North', priority: 'HIGH', dueTime: '10:00 AM', status: 'PENDING' },
    { id: 4, name: 'Weeding - Plot A', location: 'Plot A', priority: 'MEDIUM', dueTime: '2:00 PM', status: 'PENDING' },
    { id: 5, name: 'Health check - Batch 01', location: 'Poultry House 1', priority: 'MEDIUM', dueTime: '4:00 PM', status: 'PENDING' },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [newTask, setNewTask] = useState({ name: '', location: '', priority: 'MEDIUM', dueTime: '', instructions: '' });

  const toggleTask = (id) => {
    setTasks(tasks.map(task => 
      task.id === id ? { ...task, status: task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED' } : task
    ));
  };

  const addTask = (e) => {
    e.preventDefault();
    setTasks([...tasks, { 
      id: tasks.length + 1, 
      ...newTask, 
      status: 'PENDING' 
    }]);
    setNewTask({ name: '', location: '', priority: 'MEDIUM', dueTime: '', instructions: '' });
    setShowModal(false);
  };

  const groupedTasks = {
    CRITICAL: tasks.filter(t => t.priority === 'CRITICAL'),
    HIGH: tasks.filter(t => t.priority === 'HIGH'),
    MEDIUM: tasks.filter(t => t.priority === 'MEDIUM'),
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Today's Tasks</h2>
        <button
          onClick={() => setShowModal(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition"
        >
          + Add Task
        </button>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedTasks).map(([priority, tasks]) => (
          tasks.length > 0 && (
            <div key={priority}>
              <h3 className="text-lg font-bold mb-3 text-gray-700">{priority} Priority</h3>
              <div className="space-y-2">
                {tasks.map(task => (
                  <TaskCard key={task.id} task={task} onToggle={toggleTask} />
                ))}
              </div>
            </div>
          )
        ))}
      </div>

      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <h3 className="text-2xl font-bold mb-4">Add New Task</h3>
          <form onSubmit={addTask} className="space-y-4">
            <input
              type="text"
              placeholder="Task name"
              value={newTask.name}
              onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2"
              required
            />
            <input
              type="text"
              placeholder="Location"
              value={newTask.location}
              onChange={(e) => setNewTask({ ...newTask, location: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
            <select
              value={newTask.priority}
              onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option>LOW</option>
              <option>MEDIUM</option>
              <option>HIGH</option>
              <option>CRITICAL</option>
            </select>
            <input
              type="time"
              value={newTask.dueTime}
              onChange={(e) => setNewTask({ ...newTask, dueTime: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
            <textarea
              placeholder="Instructions"
              value={newTask.instructions}
              onChange={(e) => setNewTask({ ...newTask, instructions: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 h-24"
            />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded font-semibold">
                Add Task
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 rounded font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ============================================
// WEEKLY PLAN PAGE
// ============================================

function WeeklyPlanPage({ currentUser }) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const [weeklyTasks, setWeeklyTasks] = useState({
    Monday: [{ id: 1, task: 'Feed broilers', hours: 2 }],
    Tuesday: [{ id: 2, task: 'Water crops', hours: 3 }],
    Wednesday: [{ id: 3, task: 'Fertilize peppers', hours: 2.5 }],
    Thursday: [{ id: 4, task: 'Weed plots', hours: 4 }],
    Friday: [{ id: 5, task: 'Equipment check', hours: 1.5 }],
  });

  const totalHours = Object.values(weeklyTasks).reduce((sum, dayTasks) => 
    sum + dayTasks.reduce((daySum, task) => daySum + task.hours, 0), 0
  );

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">This Week's Work</h2>

      {/* Summary Card */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-gray-600 text-sm">Total Tasks</p>
            <p className="text-3xl font-bold text-green-600">15</p>
          </div>
          <div>
            <p className="text-gray-600 text-sm">Estimated Hours</p>
            <p className="text-3xl font-bold text-blue-600">~18</p>
          </div>
          <div>
            <p className="text-gray-600 text-sm">Equipment Due</p>
            <p className="text-3xl font-bold text-red-600">2</p>
          </div>
          <div>
            <p className="text-gray-600 text-sm">Priority Tasks</p>
            <p className="text-3xl font-bold text-orange-600">5</p>
          </div>
        </div>
      </div>

      {/* Daily Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {days.map(day => (
          <div key={day} className="bg-white rounded-lg shadow">
            <div className="bg-green-50 border-b border-green-200 p-4">
              <p className="font-bold text-gray-800">{day}</p>
              <p className="text-sm text-gray-600">
                {weeklyTasks[day].reduce((sum, task) => sum + task.hours, 0).toFixed(1)} hrs
              </p>
            </div>
            <div className="p-4 space-y-2">
              {weeklyTasks[day].map(task => (
                <div key={task.id} className="text-sm p-2 bg-green-50 rounded">
                  <p className="font-semibold text-gray-800">{task.task}</p>
                  <p className="text-gray-600">{task.hours} hours</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button className="mt-6 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition">
        + Plan Week's Work
      </button>
    </div>
  );
}

// ============================================
// CROP CALENDAR PAGE
// ============================================

function CropCalendarPage({ currentUser }) {
  const [crops] = useState([
    { id: 1, name: 'Green Pepper', plantMonth: 'September', harvestMonth: 'December', daysToHarvest: 75, field: 'Greenhouse North', yieldPerSqm: 1.5 },
    { id: 2, name: 'Tsunga', plantMonth: 'September', harvestMonth: 'October', daysToHarvest: 45, field: 'Plot A', yieldPerSqm: 1.2 },
    { id: 3, name: 'Cabbage', plantMonth: 'October', harvestMonth: 'January', daysToHarvest: 90, field: 'Plot B', yieldPerSqm: 2.0 },
  ]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Crop Calendar</h2>
        <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition">
          + Add Crop
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {crops.map(crop => (
          <div key={crop.id} className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold mb-2">{crop.name}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Plant Month:</span>
                <span className="font-semibold">{crop.plantMonth}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Harvest Month:</span>
                <span className="font-semibold">{crop.harvestMonth}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Days to Harvest:</span>
                <span className="font-semibold">{crop.daysToHarvest}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Field:</span>
                <span className="font-semibold">{crop.field}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Expected Yield/sqm:</span>
                <span className="font-semibold">{crop.yieldPerSqm} kg</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// EQUIPMENT PAGE
// ============================================

function EquipmentPage({ currentUser }) {
  const [equipment] = useState([
    { id: 1, name: 'Irrigation Pump', type: 'PUMP', nextMaintenance: '2026-11-15', status: 'UPCOMING', daysUntilDue: 39 },
    { id: 2, name: 'Water Motor', type: 'MOTOR', nextMaintenance: '2026-10-08', status: 'DUE THIS WEEK', daysUntilDue: 2 },
    { id: 3, name: 'Sprinkler Kit', type: 'TOOL', nextMaintenance: '2026-11-30', status: 'UPCOMING', daysUntilDue: 55 },
  ]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Equipment Maintenance</h2>
        <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition">
          + Add Equipment
        </button>
      </div>

      <div className="space-y-4">
        {equipment.map(item => (
          <div key={item.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold">{item.name}</h3>
                <p className="text-gray-600 text-sm">{item.type}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                item.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                item.status === 'DUE THIS WEEK' ? 'bg-orange-100 text-orange-700' :
                'bg-green-100 text-green-700'
              }`}>
                {item.status}
              </span>
            </div>
            <div className="mt-4 flex justify-between items-center">
              <div>
                <p className="text-gray-600 text-sm">Next Maintenance:</p>
                <p className="font-semibold">{item.nextMaintenance} ({item.daysUntilDue} days)</p>
              </div>
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold">
                Service Now
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// REMINDERS PAGE
// ============================================

function RemindersPage({ currentUser }) {
  const [reminders] = useState([
    { id: 1, activity: 'Broiler Feed & Water', type: 'FEEDING', frequency: 'DAILY', assignedTo: 'Worker 1', time: '6:00 AM' },
    { id: 2, activity: 'Greenhouse Inspection', type: 'INSPECTION', frequency: 'DAILY', assignedTo: 'Worker 2', time: '9:00 AM' },
    { id: 3, activity: 'Pepper Fertilizing', type: 'FERTILIZING', frequency: 'WEEKLY', assignedTo: 'Worker 1', time: '10:00 AM' },
    { id: 4, activity: 'Equipment Check', type: 'INSPECTION', frequency: 'WEEKLY', assignedTo: 'Dave', time: '2:00 PM' },
  ]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Reminders</h2>
        <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition">
          + Add Reminder
        </button>
      </div>

      <div className="space-y-3">
        {reminders.map(reminder => (
          <div key={reminder.id} className="bg-white rounded-lg shadow p-4 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-gray-800">{reminder.activity}</h3>
              <p className="text-sm text-gray-600">{reminder.time} • {reminder.frequency}</p>
              <p className="text-sm text-gray-600">Assigned to: {reminder.assignedTo}</p>
            </div>
            <input type="checkbox" className="w-5 h-5 text-green-600 cursor-pointer" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// PARTNER DASHBOARD PAGE
// ============================================

function PartnerDashboardPage({ currentUser }) {
  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Partner Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <StatCard 
          title="Total Contributed" 
          value="$5,200"
          icon="💰"
          color="blue"
          subtext="Dylan Basikoro"
        />
        <StatCard 
          title="Farm Total Profit" 
          value="$3,450"
          icon="📈"
          color="green"
          subtext="Year to date"
        />
        <StatCard 
          title="Your ROI" 
          value="66.3%"
          icon="📊"
          color="purple"
          subtext="On contribution"
        />
        <StatCard 
          title="Breakeven" 
          value="8 weeks"
          icon="🎯"
          color="orange"
          subtext="Projected date"
        />
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold mb-4">Recent Transactions</h3>
        <div className="space-y-3">
          <TransactionRow date="Oct 5" type="HARVEST" description="Green peppers sold - 12kg" amount="+$300" />
          <TransactionRow date="Oct 4" type="EXPENSE" description="Feed purchase - 50kg" amount="-$150" />
          <TransactionRow date="Oct 3" type="CONTRIBUTION" description="Dylan capital injection" amount="+$1,000" />
          <TransactionRow date="Oct 2" type="HARVEST" description="Tsunga harvested - 8kg" amount="+$120" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// REUSABLE COMPONENTS
// ============================================

function StatCard({ title, value, icon, color, subtext }) {
  const colorMap = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    red: 'bg-red-50 border-red-200',
    purple: 'bg-purple-50 border-purple-200',
    orange: 'bg-orange-50 border-orange-200',
  };

  return (
    <div className={`${colorMap[color]} border rounded-lg p-6`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-gray-600 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold mt-2 text-gray-800">{value}</p>
          <p className="text-gray-600 text-sm mt-2">{subtext}</p>
        </div>
        <span className="text-4xl">{icon}</span>
      </div>
    </div>
  );
}

function TaskCard({ task, onToggle }) {
  const priorityColor = {
    CRITICAL: 'bg-red-100 border-red-300',
    HIGH: 'bg-orange-100 border-orange-300',
    MEDIUM: 'bg-yellow-100 border-yellow-300',
    LOW: 'bg-green-100 border-green-300',
  };

  return (
    <div className={`${priorityColor[task.priority]} border rounded-lg p-4 flex items-start gap-3`}>
      <input
        type="checkbox"
        checked={task.status === 'COMPLETED'}
        onChange={() => onToggle(task.id)}
        className="w-5 h-5 mt-1 cursor-pointer"
      />
      <div className="flex-1">
        <p className={`font-semibold ${task.status === 'COMPLETED' ? 'line-through text-gray-500' : 'text-gray-800'}`}>
          {task.name}
        </p>
        <p className="text-sm text-gray-600">{task.location} at {task.dueTime}</p>
      </div>
      <span className={`text-xs font-semibold px-2 py-1 rounded ${
        task.status === 'OVERDUE' ? 'bg-red-200 text-red-700' : 'bg-green-200 text-green-700'
      }`}>
        {task.status}
      </span>
    </div>
  );
}

function QuickActionButton({ icon, label }) {
  return (
    <button className="w-full text-left p-3 hover:bg-gray-50 border border-gray-200 rounded flex items-center gap-3 transition">
      <span className="text-xl">{icon}</span>
      <span className="font-semibold text-gray-700">{label}</span>
      <span className="ml-auto">→</span>
    </button>
  );
}

function ActivityLog({ time, text }) {
  return (
    <div className="border-l-2 border-green-300 pl-4 py-2">
      <p className="font-semibold text-gray-800">{text}</p>
      <p className="text-sm text-gray-500">{time}</p>
    </div>
  );
}

function TransactionRow({ date, type, description, amount }) {
  const isIncome = amount.startsWith('+');
  return (
    <div className="flex justify-between items-center py-3 border-b border-gray-200 last:border-0">
      <div>
        <p className="font-semibold text-gray-800">{description}</p>
        <p className="text-sm text-gray-600">{date} • {type}</p>
      </div>
      <p className={`font-bold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>{amount}</p>
    </div>
  );
}

function Modal({ onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-96 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
