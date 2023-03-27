const dotenv = require("dotenv");
const sqlite3 = require("sqlite3").verbose();
const async = require("async");

dotenv.config();

const httpOptions = {
  method: "GET",
  headers: {
    accept: "application/json",
    "api-key": process.env.API_KEY,
  },
};

async function doFetch({ endpoint }) {
  const response = await fetch(
    `https://api.sendinblue.com/v3/${endpoint}`,
    httpOptions
  );
  return await response.json();
}

async function getContactIds() {
  const contactsInfo = await doFetch({ endpoint: "contacts?limit=1" });
  const numberOfContacts = contactsInfo.count;
  console.log(`Retrieving ${numberOfContacts} contacts...`);

  const limit = 1000;
  const allContacts = [];
  for (let offset = 0; offset < numberOfContacts; offset += limit) {
    const contacts = await doFetch({
      endpoint: `contacts?limit=${limit}&offset=${offset}`,
      limit,
      offset,
    });
    allContacts.push(...contacts.contacts.map((contact) => contact.id));
    console.log(` ...${allContacts.length} / ${numberOfContacts}`);
  }
  return allContacts;
}

const getContactEvents = (progress, contactId) => async (timePeriod) => {
  const contactEvents = await doFetch({
    endpoint: `contacts/${contactId}/campaignStats?startDate=${timePeriod[0]}&endDate=${timePeriod[1]}`,
  });

  const events = [];
  if (contactEvents.delivered) {
    events.push(
      ...contactEvents.delivered.map((event) => {
        return {
          contactId,
          campaignId: event.campaignId,
          time: event.eventTime,
          type: "delivered",
        };
      })
    );
  }
  if (contactEvents.opened) {
    events.push(
      ...contactEvents.opened.map((event) => {
        return {
          contactId,
          campaignId: event.campaignId,
          count: event.count,
          time: event.eventTime,
          // don't include event.ip
          type: "opened",
        };
      })
    );
  }
  if (contactEvents.clicked) {
    for (const event of contactEvents.clicked) {
      for (const link of event.links) {
        events.push({
          contactId,
          campaignId: event.campaignId,
          count: link.count,
          time: link.eventTime,
          link: link.url,
          type: "clicked",
        });
      }
    }
  }
  progress.increment();
  return events;
};

async function saveEventsToDB(events) {
  const db = new sqlite3.Database("sib.db");

  db.serialize(function () {
    db.run("DROP TABLE IF EXISTS events");
    db.run(`
    CREATE TABLE events (
      contactId INTEGER NOT NULL,
      campaignId INTEGER NOT NULL,
      count INTEGER,
      time DATETIME NOT NULL,
      link TEXT,
      type TEXT NOT NULL
    );
  `);

    console.log("Inserting events into DB...");
    db.run("begin transaction");
    for (const [index, event] of events.entries()) {
      db.run(
        `
      INSERT INTO events (contactId, campaignId, count, time, link, type)
      VALUES 
        (${event.contactId}, ${event.campaignId}, ${event.count || "NULL"}, "${
          event.time
        }", "${event.link || "NULL"}", "${event.type}");
      `
      );
      console.log(`...${index + 1} / ${events.length}`);
    }

    db.run("commit");
  });
  db.close();
}

class Progress {
  constructor(total) {
    this.total = total;
    this.current = 0;
  }

  increment() {
    this.current += 1;
    console.log(this.current, "/", this.total);
  }
}

async function extractContactData() {
  const timePeriods = [
    ["2022-01-01", "2022-03-31"],
    ["2022-04-01", "2022-06-29"],
    ["2022-06-30", "2022-09-28"],
    ["2022-09-29", "2022-12-28"],
    ["2022-12-29", "2023-03-12"],
  ];

  const contactIds = await getContactIds();

  console.log("Retrieving contact events...");

  const maxParallel = 15;
  const progress = new Progress(contactIds.length * timePeriods.length);

  const events = await async.concatLimit(
    contactIds,
    maxParallel,
    async (contactId) =>
      await async.concatSeries(
        timePeriods,
        getContactEvents(progress, contactId)
      )
  );

  console.log(events);

  if (events.length > 0) {
    await saveEventsToDB(events);
  }
}

async function getCampaigns() {
  const campaignsInfo = await doFetch({
    endpoint: "emailCampaigns?status=sent&limit=1",
  });
  const numberOfCampaigns = campaignsInfo.count;
  console.log(`Retrieving ${numberOfCampaigns} campaigns...`);

  const limit = 100;
  const allCampaigns = [];
  for (let offset = 0; offset < numberOfCampaigns; offset += limit) {
    const campaigns = await doFetch({
      endpoint: `emailCampaigns?status=sent&limit=${limit}&offset=${offset}`,
      limit,
      offset,
    });
    allCampaigns.push(
      ...campaigns.campaigns.map((campaign) => {
        return {
          id: campaign.id,
          name: campaign.name,
          sentDate: campaign.sentDate,
          subject: campaign.subject,
          testSent: campaign.testSent,
          type: campaign.type,
          status: campaign.status,
        };
      })
    );
    console.log(` ...${allCampaigns.length} / ${numberOfCampaigns}`);
  }
  return allCampaigns;
}

async function saveCampaignsToDB(campaigns) {
  const db = new sqlite3.Database("sib.db");

  db.serialize(function () {
    db.run("DROP TABLE IF EXISTS campaigns");
    db.run(`
    CREATE TABLE campaigns (
      id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sentDate DATETIME NOT NULL,
      subject TEXT NOT NULL,
      testSent BOOLEAN,
      type TEXT NOT NULL,
      status TEXT NOT NULL
    );
  `);

    console.log("Inserting campaigns into DB...");
    db.run("begin transaction");
    for (const [index, campaign] of campaigns.entries()) {
      db.run(
        `
      INSERT INTO campaigns (id, name, sentDate, subject, testSent, type, status)
      VALUES 
        (${campaign.id}, "${campaign.name}", "${campaign.sentDate}", "${campaign.subject}", ${campaign.testSent}, "${campaign.type}", "${campaign.status}");
      `
      );
      console.log(`...${index + 1} / ${campaigns.length}`);
    }
    db.run("commit");
  });
  db.close();
}

async function extractCampaignData() {
  const campaigns = await getCampaigns();
  if (campaigns.length > 0) {
    await saveCampaignsToDB(campaigns);
  }
}

async function main() {
  await extractContactData();
  await extractCampaignData();
}

main();
