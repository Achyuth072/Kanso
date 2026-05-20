import webpush from "web-push";

const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT;

if (publicVapidKey && privateVapidKey && vapidSubject) {
  webpush.setVapidDetails(vapidSubject, publicVapidKey, privateVapidKey);
} else {
  console.warn("[Push Init] VAPID configuration missing or incomplete");
}

export { webpush };
