require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage
const appointments = [];

// OAuth2 setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

// Date and Time Service
const DateTimeService = {
  getRelativeDate: (date) => {
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Reset time parts for accurate date comparison
    today.setHours(0, 0, 0, 0);
    tomorrow.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    if (date.getTime() === today.getTime()) {
      return "Today";
    } else if (date.getTime() === tomorrow.getTime()) {
      return "Tomorrow";
    }

    // Get day name for dates within next 7 days
    const daysUntil = Math.floor((date - today) / (1000 * 60 * 60 * 24));
    if (daysUntil > 0 && daysUntil < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    }

    // For other dates, return formatted date
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  },

  parseRelativeDate: (dateStr) => {
    // Create dates in IST
    if (!dateStr || typeof dateStr !== 'string') return null;
    dateStr = dateStr.toLowerCase().trim();
    
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // dateStr = dateStr.toLowerCase().trim();
    
    // Handle relative dates (today, tomorrow)
    switch (dateStr) {
      case 'today':
        return today;
      case 'tomorrow':
        return tomorrow;
    }

    // Handle weekdays (e.g., "monday", "tuesday")
    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const weekdayIndex = weekdays.indexOf(dateStr);
    if (weekdayIndex !== -1) {
      const targetDate = new Date(today);
      const currentDay = today.getDay();
      let daysToAdd = weekdayIndex - currentDay;
      if (daysToAdd <= 0) { // If the day has passed this week, go to next week
        daysToAdd += 7;
      }
      targetDate.setDate(today.getDate() + daysToAdd);
      return targetDate;
    }

    // Handle "DD Month" or "DD MonthName" format (e.g., "22 june", "23 august")
    const monthNames = {
      'january': 0, 'jan': 0,
      'february': 1, 'feb': 1,
      'march': 2, 'mar': 2,
      'april': 3, 'apr': 3,
      'may': 4,
      'june': 5, 'jun': 5,
      'july': 6, 'jul': 6,
      'august': 7, 'aug': 7,
      'september': 8, 'sep': 8,
      'october': 9, 'oct': 9,
      'november': 10, 'nov': 10,
      'december': 11, 'dec': 11
    };

    // Match patterns like "22 june" or "23 aug"
    const dateMonthMatch = dateStr.match(/^(\d{1,2})\s*([a-z]+)$/);
    if (dateMonthMatch) {
      const day = parseInt(dateMonthMatch[1]);
      const monthStr = dateMonthMatch[2];
      const monthIndex = monthNames[monthStr];
      
      if (monthIndex !== undefined && day >= 1 && day <= 31) {
        const targetDate = new Date(today.getFullYear(), monthIndex, day);
        
        // If the date has already passed this year, set it to next year
        if (targetDate < today) {
          targetDate.setFullYear(today.getFullYear() + 1);
        }
        
        return targetDate;
      }
    }

    // Try to parse as YYYY-MM-DD
    const dateMatch = dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
    if (dateMatch) {
      // Create date in IST
      return new Date(new Date(dateStr).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    }

    return null;
  },

  parseRelativeTime: (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return null;
    timeStr = timeStr.toLowerCase().trim();
    
    // Handle formats like "2PM", "2:30PM", "14:30", "14:00"
    const timeRegex12Hr = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i;
    const timeRegex24Hr = /^(\d{2}):(\d{2})$/;
    
    let hours = 0;
    let minutes = 0;
    
    // Try 12-hour format first
    const match12Hr = timeStr.match(timeRegex12Hr);
    if (match12Hr) {
      hours = parseInt(match12Hr[1]);
      minutes = match12Hr[2] ? parseInt(match12Hr[2]) : 0;
      const isPM = match12Hr[3].toLowerCase() === 'pm';
      
      if (isPM && hours !== 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
    } else {
      // Try 24-hour format
      const match24Hr = timeStr.match(timeRegex24Hr);
      if (match24Hr) {
        hours = parseInt(match24Hr[1]);
        minutes = parseInt(match24Hr[2]);
      }
    }
    
    // Validate hours and minutes
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    
    return null;
  },

  formatDate: (date) => {
    return date.toISOString().split('T')[0];
  },

  formatDateForDisplay: (date) => {
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  },

  // New method to convert local time to IST
  convertToIST: (date, time) => {
    // Create a date object with the given date and time in IST
    const [hours, minutes] = time.split(':');
    const dateTimeIST = new Date(date);
    dateTimeIST.setHours(parseInt(hours), parseInt(minutes));

    // Format the date in IST
    const options = {
      timeZone: 'Asia/Kolkata',
      hour12: false
    };

    return dateTimeIST;
  }
};

// Services
const CalendarService = {
  createEvent: async (appointmentData) => {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Convert appointment time to IST
    const startDateTime = DateTimeService.convertToIST(appointmentData.date, appointmentData.time);
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour duration

    const event = {
      summary: `Appointment: ${appointmentData.name}`,
      description: appointmentData.description || 'No description provided',
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      attendees: [{ email: appointmentData.email }],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
    };

    return calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      sendUpdates: 'all',
    });
  }
};

const EmailService = {
  sendAppointmentConfirmation: async (appointmentData) => {
    // Convert to IST for email display
    const appointmentDateTime = DateTimeService.convertToIST(appointmentData.date, appointmentData.time);
    const formattedTime = appointmentDateTime.toLocaleTimeString('en-US', { 
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true 
    });
    const formattedDate = appointmentDateTime.toLocaleDateString('en-US', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: appointmentData.email,
      subject: 'Appointment Confirmation',
      html: `
        <h2>Appointment Confirmed</h2>
        <p>Dear ${appointmentData.name},</p>
        <p>Your appointment has been scheduled for ${formattedDate} at ${formattedTime} IST.</p>
        <p>Description: ${appointmentData.description || 'No description provided'}</p>
        <p>The event has been added to your calendar.</p>
        <p>Best regards,<br>Your Appointment Team</p>
      `
    };

    return transporter.sendMail(mailOptions);
  }
};

const VAPIService = {
  fetchCallDetails: async (callId) => {
    const url = `https://api.vapi.ai/call/${callId}`;
    const headers = {
      'Authorization': `Bearer ${process.env.VAPI_API_KEY}`
    };
    return axios.get(url, { headers });
  }
};

// Routes
// OAuth2 routes
app.get('/auth/google', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
  });
  res.json({ url });
});

app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    process.env.GOOGLE_ACCESS_TOKEN = tokens.access_token;
    process.env.GOOGLE_REFRESH_TOKEN = tokens.refresh_token;
    res.send('Authentication successful! You can close this window.');
  } catch (error) {
    console.error('Error getting tokens:', error);
    res.status(500).send('Authentication failed!');
  }
});

// VAPI routes
app.get('/call-details', async (req, res) => {
  const callId = req.query.call_id;
  
  if (!callId) {
    return res.status(400).json({ error: 'Call ID is required' });
  }

  try {
    const response = await VAPIService.fetchCallDetails(callId);
    console.log('Call data received:', response.data);

    const analysis = response.data.analysis;

    // Process structured data for appointment if available
    if (analysis?.structuredData) {
      const parsedDate = DateTimeService.parseRelativeDate(analysis.structuredData.date);
      const parsedTime = DateTimeService.parseRelativeTime(analysis.structuredData.time);

      if (!parsedDate || !parsedTime) {
        analysis.appointment = {
          success: false,
          message: 'Failed to parse date or time',
          error: 'Invalid date or time format'
        };
      } else {
        const appointmentData = {
          name: analysis.structuredData.name || '',
          email: analysis.structuredData.email || '',
          date: DateTimeService.formatDate(parsedDate),
          displayDate: {
            relative: DateTimeService.getRelativeDate(parsedDate),
            formatted: DateTimeService.formatDateForDisplay(parsedDate)
          },
          time: parsedTime,
          description: analysis.structuredData.purpose || 'Appointment from voice call'
        };

        // Update the structuredData with the display date
        analysis.structuredData = {
          ...analysis.structuredData,
          displayDate: appointmentData.displayDate
        };

        // Only create appointment if we have the minimum required data
        if (appointmentData.name && appointmentData.email && appointmentData.date && appointmentData.time) {
          try {
            // Set credentials if available
            if (process.env.GOOGLE_ACCESS_TOKEN && process.env.GOOGLE_REFRESH_TOKEN) {
              oauth2Client.setCredentials({
                access_token: process.env.GOOGLE_ACCESS_TOKEN,
                refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
              });
            }

            // Create calendar event
            const calendarResponse = await CalendarService.createEvent(appointmentData);

            // Create appointment object
            const appointment = {
              id: calendarResponse.data.id,
              ...appointmentData,
              bookingTime: new Date().toISOString(),
              calendarLink: calendarResponse.data.htmlLink,
              status: 'Confirmed'
            };

            // Store appointment
            appointments.push(appointment);

            // Send confirmation email
            await EmailService.sendAppointmentConfirmation(appointment);

            // Update the structuredData with calendar link
            analysis.structuredData = {
              ...analysis.structuredData,
              calendarLink: calendarResponse.data.htmlLink
            };

            // Add appointment data to the response
            analysis.appointment = {
              success: true,
              message: 'Appointment scheduled successfully!',
              details: appointment
            };

            // Debug log
            // console.log('\nAppointment Details:', analysis.appointment);

          } catch (error) {
            console.error('Error creating appointment:', error);
            analysis.appointment = {
              success: false,
              message: 'Failed to schedule appointment',
              error: error.message
            };

            if (error.code === 401) {
              analysis.appointment.authUrl = oauth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: ['https://www.googleapis.com/auth/calendar'],
              });
            }
          }
        }
      }
    }

    return res.status(200).json({
      analysis: analysis
    });
  } catch (error) {
    console.error('Error fetching call details:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to fetch call details'
    });
  }
});

// Auth status route
app.get('/auth/status', (req, res) => {
  const isAuthenticated = !!(process.env.GOOGLE_ACCESS_TOKEN && process.env.GOOGLE_REFRESH_TOKEN);
  res.json({ isAuthenticated });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('\nAPI Endpoints:');
  console.log('1. GET  /call-details      - Get VAPI call details and create appointment');
  console.log('2. GET  /auth/google       - Start OAuth2 flow');
  console.log('3. GET  /auth/status       - Check authentication status\n');
}); 
