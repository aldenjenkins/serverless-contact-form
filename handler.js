'use strict';
const request = require('request');
const config = require('./config.json');
const secretKey = config['captchaSecret'];
const myEmail = config['sendMailTo'];
const AWS = require('aws-sdk');
if (!AWS.config.region) {
  AWS.config.update({
    region: 'us-east-1'
  });
}
const ses = new AWS.SES();


// function to convert query string to object
function QueryStringToObj(str) {
  let obj = {};
  str.replace(/([^=&]+)=([^&]*)/g, (m, key, value) => {
    obj[decodeURIComponent(key)] = decodeURIComponent(value).replace(/\+/g, ' ');
  });
  return obj;
}

module.exports.processFormData =   (event, context, callback) => {

  // log the incoming data
  console.log('Received event:', JSON.stringify(event, null, 2));
  // check if form data has actually been sent

  if(! event.body || event.body.trim() === '') {
    callback(null, {
      statusCode: 500,
      body: 'Form data not sent'
    });
    return;

  } else {
      console.log(event.body);
    // convert form fields to an object
    event.body = QueryStringToObj(event.body);
  }

  // log form data object
  console.log('Form Data:', JSON.stringify(event.body, null, 2));

  // Check that the name has been sent, and that the name isn't empty
  if (! event.body.name || event.body.name.trim() === '') {
    callback(null, {
      statusCode: 500,
      body: 'Name is required.'
    });
    return;
  }

    function checkEmail(){

  // check that the email has been sent
  if (! event.body.email) {
    callback(null, {
      statusCode: 500,
      body: 'Email address is required.'
    });
    return;
  }

  // setup an email regex
  const email_regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

  // check the submitted email is valid
  if (! email_regex.test(event.body.email)) {
    callback(null, {
      statusCode: 500,
      body: 'The email not valid'
    });
    return;
  }
    }

    function checkMessage(){

  // check the message has been sent, and that it's not empty
  if (! event.body.message || event.body.message.trim() === '') {
    callback(null, {
      statusCode: 500,
      body: 'Message is required.'
    });
    return;
  }

  // basic spam check
  if (event.body.message.indexOf('<a') !== -1) {
    callback(null, {
      statusCode: 500,
      body: 'Spam detected.'
    });
    return;
  }


  if(event.body['g-recaptcha-response'] === undefined || event.body['g-recaptcha-response'] === '' || event.body['g-recaptcha-response'] === null) {
    callback(null, {
      statusCode: 500,
      body: 'Please select captcha.'
    });
    return
  }
    }

 function checkCaptcha(url) {
  return new Promise(function (resolve, reject) {
    request(url,function(error,response,body) {
      body = JSON.parse(body);
      // Success will be true or false depending upon captcha validation.
      if (!error && response.statusCode == 200 && body.success == true){
          console.log('good captcha');
          resolve(true);
      }else{
          callback(null, {
              statusCode: 500,
              body: 'bad captcha'
          });
          return
      }
    });
  });
}

  // Hitting GET request to the URL, Google will respond with success or error scenario.
//var verify_captcha = await checkCaptcha(verificationUrl);
function sendMail(){

  // Put together all info needed to send the email
  const name = event.body.name.trim(),
        email = unescape(event.body.email.trim()),
        replyTo = event.body.name + " <" + email + ">",
        subject = "Website message from " + name,
        message = "Website message from " + name + " <" + email + ">\n\n" + event.body.message.trim();

 console.log(name);
  // Send the email via SES.
  ses.sendEmail({
    Destination: {
      ToAddresses: [
          'Alden Jenkins <' + myEmail + '>'
      ]
    },
    Message: {
      Body: {
        Text: {
          Data: message,
          Charset: 'UTF-8'
        }
      },
      Subject: {
        Data: subject,
        Charset: 'UTF-8'
      }
    },
    Source: "Contact Form <" + myEmail + ">",
    ReplyToAddresses: [
      replyTo
    ]
  }, (err, data) => {

  console.log('sending email');
    if (err) {
      // email was not sent
      console.log('Error Sending Email:', JSON.stringify(err, null, 2));

      callback(null, {
        statusCode: 500,
        body: 'Message could not be sent'
      });

    } else {

    console.log('email sent')
      if(event.body.redirectUrl) {
          // if a redirect URL has been passed, redirect to that URL
          console.log('redirecting to', event.body.redirectUrl)
        callback(null, {
          statusCode: 302,
          headers: {
            'Location': event.body.redirectUrl,
          }

        });

      } else {
        callback(null, {
          statusCode: 200,
          body: 'success'
        });
      }
    }
  });
}
  (async () => {
  var verificationUrl = "https://www.google.com/recaptcha/api/siteverify?secret=" + secretKey + "&response=" + event.body['g-recaptcha-response'] 
      await Promise.all([checkEmail(), checkMessage(), checkCaptcha(verificationUrl)]);
      sendMail();  
  })()

}
