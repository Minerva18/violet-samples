/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

'use strict';

// Inspired by: http://blog.jeffdouglas.com/2015/08/12/alexa-for-salesforce-with-amazon-echo/

var moment = require('moment-timezone');
var pluralize = require('pluralize');

var violet = require('violet').script();
var violetClientTx = require('violet/lib/violetClientTx')(violet);
var violetTime = require('violet/lib/violetTime')(violet);

var violetSFStore = require('violet/lib/violetStoreSF')(violet);
violetSFStore.store.propOfInterest = {
  'Lead*': ['Name*', 'Company*'],
  'Opportunity*': ['Name*', 'StageName*', 'Probability*', 'Amount*'],
  'Event*': ['StartDateTime*', 'Subject*', 'Who*.Name*']
}

violet.addInputTypes({
  "name": {
      "type": "AMAZON.LITERAL",
      "sampleValues": ["Jeff Douglas", "Steve Jones", "Mike Smith", "Mary Stewart"]
  },
  "company": {
      "type": "AMAZON.LITERAL",
      "sampleValues": ["ACME Corp", "ABC Company", "Fresh Foods Packaging"]
  },
  "opportunityName": {
      "type": "AMAZON.LITERAL",
      "sampleValues": ["Jones", "Edge S L A", "United Oil Standby Generators"]
  }
});



// help with script
violet.respondTo({
  expecting: [
    'help {me|}',
    'what {commands|questions} can I {ask|say}',
    'what can I {do|ask you}',
    'what {do|can} I use you',
    'what {do|can} you do',
    'get help',
    'what can I use this for',
    'what can you tell me'
  ],
  resolve: function (response) {
    response.say(`
      You can ask to check for any new leads, your calendar for
      today, the status of a specific opportunity or, to create a new lead...
      What can I help you with?`
    );
}});

// TODO: how can we make the below (nested goals more intuitive????) .... esp with primitives like goalFilled
// create a lead
violet.respondTo({
  expecting: ['{to|} create a {new|} lead'],
  resolve: (response) => {
    response.say("OK, let's create a new lead.");
    response.addGoal('createLeadName');
}});

violet.defineGoal({
  goal: 'createLeadName',
  prompt: ["What is the person's first and last name?"],
  respondTo: [{
    expecting: ['[[name]]'],
    resolve: (response) => {
      response.say("Got it. the name is, [[name]].")
      response.set('name', response.get('name'));
      response.addGoal('createLeadCompany');
  }}]
});

violet.defineGoal({
  goal: 'createLeadCompany',
  prompt: ["What is the company name?"],
  respondTo: [{
    expecting: ['[[company]]'],
    resolve: (response) => {
      response.say("Bingo! I created a new lead for {{name}} with the company name [[company]]")
      var names = response.get('name').split(' ');
      response.store('Lead*', {
        'FirstName*': names[0],
        'LastName*': names[1],
        'Company*': response.get('company')
      });
  }}]
});


// check for any new leads
violet.respondTo({
  expecting: ['{for|} {any|my} new leads'],
  resolve: function *(response) {
    var results = yield response.load('Lead*', null, null, 'CreatedDate = TODAY');
    if (results.length == 0) {
      response.say('Sorry, you do not have any new leads for today.');
      return;
    }
    console.log(results);
    var speechOutput = 'You have ' + results.length + ' new ' + pluralize('lead', results.length) + ', ';
    results.forEach((rec, i)=>{
      speechOutput +=  i+1 + ', ' + rec.Name + ' from ' + rec.Company + ', ';
      if (i === results.length-2) speechOutput += ' and ';
    });
    speechOutput += ', Go get them tiger!';
    response.say(speechOutput);
}});

// opportunity status
violet.respondTo({
  expecting: ['{for|about} opportunity [[opportunityName]]'],
  resolve: function *(response) {
    var results = yield response.load('Opportunity*', 'Name*', response.get('opportunityName'));
    if (results.length == 0) {
      response.say('Sorry, I could not find an Opportunity named, [[opportunityName]]');
      return;
    }
    var opp = results[0];
    response.say(
      `I found Opportunity [[opportunityName]] for \$${opp.Amount}, the stage
      is ${opp.StageName} and the probability is ${opp.Probability} %`
    );
}});

// check my calendar
violet.respondTo({
  expecting: ['{for|} my calendar {for today|}'],
  resolve: function *(response) {
    var results = yield response.load('Event*', null, null, 'startdatetime = TODAY order by StartDateTime');
    var speechOutput = 'You have  ' + results.length + ' ' + pluralize('event', results.length) + ' for today, ';
    results.forEach(function(rec) {
      speechOutput += 'At ' + moment(rec.StartDateTime).tz('America/Los_Angeles').format('h:m a') + ', ' + rec.Subject;
      if (rec.Who) speechOutput += ', with  ' + rec.Who.Name;
      speechOutput += ', ';
    });
    response.say(speechOutput);
}});


module.exports = violet;
