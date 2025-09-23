import React, { useState } from "react";
import EmployeeWorkspace from "./EmployeeWorkspace";
import ResidentsWorkspace from "./ResidentsWorkspace";

const PEOPLE_SECTIONS = [
  {
    key: "residents",
    title: "Residents",
    description: "Manage resident information and care plans",
    icon: "🏠",
    color: "bg-blue-50 border-blue-200 text-blue-700"
  },
  {
    key: "employees",
    title: "Employees",
    description: "Employee onboarding, roles, and assignments",
    icon: "👥",
    color: "bg-green-50 border-green-200 text-green-700"
  },
  {
    key: "guardians",
    title: "Guardians",
    description: "Guardian contacts and checklist management",
    icon: "👤",
    color: "bg-purple-50 border-purple-200 text-purple-700"
  }
];

export default function PeopleWorkspace() {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  if (activeSection === "employees") {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setActiveSection(null)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            ← Back to People
          </button>
          <h3 className="text-2xl font-bold text-gray-900">Employee Management</h3>
        </div>
        <EmployeeWorkspace />
      </div>
    );
  }

  if (activeSection === "residents") {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setActiveSection(null)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            ← Back to People
          </button>
          <h3 className="text-2xl font-bold text-gray-900">Resident Management</h3>
        </div>
        <ResidentsWorkspace />
      </div>
    );
  }

  if (activeSection) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setActiveSection(null)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            ← Back to People
          </button>
          <h3 className="text-2xl font-bold text-gray-900">
            {PEOPLE_SECTIONS.find(s => s.key === activeSection)?.title}
          </h3>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <div className="text-4xl mb-4">
            {PEOPLE_SECTIONS.find(s => s.key === activeSection)?.icon}
          </div>
          <h4 className="text-xl font-semibold mb-2">
            {PEOPLE_SECTIONS.find(s => s.key === activeSection)?.title}
          </h4>
          <p className="text-gray-600 mb-4">
            {PEOPLE_SECTIONS.find(s => s.key === activeSection)?.description}
          </p>
          <p className="text-sm text-gray-500">
            This section will be implemented in a future update.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PEOPLE_SECTIONS.map((section) => (
          <div
            key={section.key}
            className={section.color + " border-2 rounded-lg p-6 cursor-pointer hover:shadow-md transition-all duration-200"}
            onClick={() => setActiveSection(section.key)}
          >
            <div className="flex items-center space-x-4 mb-4">
              <div className="text-3xl">{section.icon}</div>
              <div>
                <h3 className="text-lg font-semibold">{section.title}</h3>
              </div>
            </div>
            <p className="text-sm opacity-80 mb-4">{section.description}</p>
            <div className="text-right">
              <span className="text-sm font-medium">
                {section.key === "employees"
                  ? "Manage →"
                  : section.key === "residents"
                  ? "Manage →"
                  : "Coming Soon →"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
