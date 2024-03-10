// Wait for the document to be fully loaded
$(document).ready(function() {
    // Focus on the message input field
    $('#message-input').focus();

    // Make the chat window resizable
    $('#chat-window').resizable({
        handles: 'e'
    });



    // TODO: On dropdown update, update session data


    // Scroll to the bottom of the chat window
    scrollToBottom();

    // Event listener for the send message form submission
    $('#send-message').on('submit', function(e) {
        // Prevent the default form submission action
        e.preventDefault();

        // Get the message and mode from the input fields
        var message = $('#message-input').val();
        var mode = $('#response-mode').val();

        // Clear the message input field and reset its height
        $('#message-input').val('').css('height', 'auto');

        // Append the user's message to the chat window
        $('#messages').append('<div class="user-message"><strong>You:</strong> ' + message + '</div>');

        // Scroll to the bottom of the chat window
        setTimeout(scrollToBottom, 0);

        // Don't send an empty message
        if (message.length == 0) {
            return;
        }

        // Send the message to the server and handle the response
        if (mode == "simple") {
            $.post(simple_response, { 'message': message })
                .done(function(response) {
                    $('#messages').append('<div class="bot-message"><strong>Bot:</strong> ' + response + '</div>');
                    setTimeout(scrollToBottom, 0);
                });
        } else if (mode === "complex") {
            $.post(complex_response, { 'message': message })
                .done(function(response) {
                    $('#messages').append('<div class="bot-message"><strong>Bot:</strong> ' + response + '</div>');
                    setTimeout(scrollToBottom, 0);
                });
        }
    });

    // Function to scroll to the bottom of the chat window
    function scrollToBottom() {
        const chatWindow = document.getElementById('messages');
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    // Event listener for the Enter key in the message input field
    $('#message-input').on('keydown', function(e) {
        if (e.key == 'Enter' && !e.shiftKey) {
            e.preventDefault();
            $('#send-message').submit();
        }
    });

    $('#response-mode').on('change', function() {
        $('#message-input').focus();
    });

    // Event listener for input in the message input field to adjust its height
    $('#message-input').on('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
});