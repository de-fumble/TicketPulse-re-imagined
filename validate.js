// Event listener for validating a ticket when the validation form is submitted
document.getElementById('validateForm').addEventListener('submit', async function(event) {
    event.preventDefault(); // Prevent the form from submitting in the traditional way
    
    const ticketInput = document.getElementById('ticketInput').value;
    console.log('Sending ticket input:', ticketInput); // Add this line for debugging
    
    try {
        // Send a POST request to validate the ticket using the server API
        const response = await fetch('http://localhost:3000/validate-ticket', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ticketInput }),
        });

        const result = await response.json();

        if (result.valid) {
            const ticket = result.ticket;
            const resultMessage = `Ticket Valid! Name: ${ticket.username}, Email: ${ticket.email}, Event: ${ticket.event}, Ticket Code: ${ticket.ticketCode}`;
            document.getElementById('validationResult').innerHTML = resultMessage;

            // Store the check-in data for the admin dashboard
            const checkInData = JSON.parse(localStorage.getItem('checkedInAttendees')) || []; // Retrieve existing check-ins
            ticket.checkInTime = new Date().toISOString(); // Record the check-in time
            checkInData.push(ticket); // Add the current user's details to the check-in list
            localStorage.setItem('checkedInAttendees', JSON.stringify(checkInData)); // Save the updated list
        } else {
            // If the ticket is invalid or already used, show the error message
            document.getElementById('validationResult').innerHTML = result.message;
        }
    } catch (error) {
        console.error('Error validating ticket:', error);
        document.getElementById('validationResult').innerHTML = 'An error occurred while validating the ticket.';
    }
});
