"use client";

import { useEffect } from "react";
import {
  IconBook,
  IconBriefcase,
  IconCalendar,
  IconCompass,
  IconDocument,
  IconHeart,
  IconIdCard,
  IconPeople,
  IconPhone,
  IconSitemap,
  IconTrend,
  IconUser,
  IconWallet,
} from "./components/Icons";
import Springboard from "./components/Springboard";

const QUICK = [
  { label: "Personal Details", icon: <IconUser size={20} /> },
  { label: "Document Records", icon: <IconDocument size={20} /> },
  { label: "Identification Info", icon: <IconIdCard size={20} /> },
  { label: "Contact Info", icon: <IconPhone size={20} /> },
  { label: "Family and Emergency Contacts", icon: <IconPeople size={20} /> },
  { label: "My Organization Chart", icon: <IconSitemap size={20} /> },
  { label: "Employment Info", icon: <IconBriefcase size={20} /> },
];

const APPS = [
  { label: "Directory", icon: <IconPeople size={32} /> },
  { label: "Journeys", icon: <IconCompass size={32} /> },
  { label: "Pay", icon: <IconWallet size={32} /> },
  { label: "Time Off", icon: <IconCalendar size={32} />, href: "/practice/time-off" },
  { label: "Career and Performance", icon: <IconTrend size={32} /> },
  { label: "Personal Information", icon: <IconIdCard size={32} /> },
  { label: "Benefits", icon: <IconHeart size={32} /> },
  { label: "Learning", icon: <IconBook size={32} /> },
];

export default function HomePage() {
  useEffect(() => {
    document.title = "Home · HCM practice";
  }, []);

  return (
    <Springboard
      tab="me"
      quickActions={QUICK}
      apps={APPS}
      after={
        <section className="finish" aria-labelledby="finish-h">
          <h2 className="caps" id="finish-h">
            Things to Finish
          </h2>
          <div className="card finish-card">
            <p className="finish-kicker">Assigned to Me</p>
            <p className="finish-title">Practise with the coach</p>
            <p className="muted">
              Install the coach extension in Chrome and open its side panel. It guides you through Time Off and Our
              Workforce one step at a time.
            </p>
          </div>
        </section>
      }
    />
  );
}
