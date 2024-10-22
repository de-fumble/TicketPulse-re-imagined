// Event listener for generating a ticket when the form is submitted
document.getElementById('generateForm').addEventListener('submit', async function(event) {
    event.preventDefault(); // Prevent the form from submitting in the traditional way
    
    // Retrieve the username, user-generated security key, email, and selected event from the form inputs
    const username = document.getElementById('username').value;
    const userPassword = document.getElementById('Ticket').value;
    const email = document.getElementById('Email').value;
    const selectedEvent = document.getElementById('eventSelect').value;

    // Generate a random ticket code
    const ticketCode = `TICKET-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    // Check if the user-generated security key is empty (no spaces allowed)
    if (userPassword.trim() === '') {
        alert("Ticket Security Key cannot be empty.");
        return;
    }

    // Create an object with the ticket details
    const ticketData = {
        username,
        email,
        ticketCode,
        userPassword,
        event: selectedEvent
    };

    try {
        // Send a POST request to store the ticket in Redis
        const response = await fetch('http://localhost:3000/store-ticket', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(ticketData),
        });

        if (response.ok) {
            // Display the ticket information
            document.getElementById('ticketDisplay').innerHTML = `Name: ${username} <br> Event: ${selectedEvent} <br> Ticket Code: ${ticketCode}`;
        } else {
            alert('Failed to generate ticket. Please try again.');
        }
    } catch (error) {
        console.error('Error generating ticket:', error);
        alert('An error occurred while generating the ticket.');
    }
});

// Event listener for validating a ticket when the validation form is submitted
document.getElementById('validateForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const ticketCode = document.getElementById('ticketCode').value;
    
    try {
        // Send a POST request to validate the ticket
        const response = await fetch('http://localhost:3000/validate-ticket', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ticketCode }),
        });

        const result = await response.json();

        if (result.valid) {
            // Ticket is valid
            const ticket = result.ticket;
            const resultMessage = `Ticket Valid! Name: ${ticket.username}, Email: ${ticket.email}, Event: ${ticket.event}, Ticket Code: ${ticket.ticketCode}`;
            document.getElementById('validationResult').innerHTML = resultMessage;

            // Store the check-in data for the admin dashboard
            const checkInData = JSON.parse(localStorage.getItem('checkedInAttendees')) || [];
            ticket.checkInTime = new Date().toISOString();
            checkInData.push(ticket);
            localStorage.setItem('checkedInAttendees', JSON.stringify(checkInData));
        } else {
            // Ticket is invalid or already used
            document.getElementById('validationResult').innerHTML = result.message;
        }
    } catch (error) {
        console.error('Error validating ticket:', error);
        document.getElementById('validationResult').innerHTML = 'An error occurred while validating the ticket.';
    }
});

// Admin Dashboard: Display checked-in attendees
document.addEventListener('DOMContentLoaded', function() {
    const attendeesTableBody = document.querySelector('#attendeesTable tbody'); // Get the table body for attendees
    const checkedInAttendees = JSON.parse(localStorage.getItem('checkedInAttendees')) || []; // Get the checked-in attendees list

    // Loop through each checked-in attendee and create a table row with their details
    checkedInAttendees.forEach(attendee => {
        const row = document.createElement('tr'); // Create a new row element
        row.innerHTML = `
            <td>${attendee.username}</td>          <!-- Display the attendee's name -->
            <td>${attendee.email}</td>             <!-- Display the attendee's email -->
            <td>${attendee.event}</td>             <!-- Display the event the attendee registered for -->
            <td>${attendee.ticketCode}</td>        <!-- Display the attendee's ticket code -->
            <td>${new Date(attendee.checkInTime).toLocaleString()}</td> <!-- Display the check-in time, formatted -->
        `;
        attendeesTableBody.appendChild(row); // Append the row to the table body
    });
});
