import React, { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function AdminDashboard() {
  const [showResidentModal, setShowResidentModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  // Resident form state
  const [residentName, setResidentName] = useState("");
  const [residentLocation, setResidentLocation] = useState("");
  const [residentDob, setResidentDob] = useState("");

  // Employee form state
  const [employeeName, setEmployeeName] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [employeeRole, setEmployeeRole] = useState("staff");
  const [employeeLocation, setEmployeeLocation] = useState("");

  // Broadcast form state
  const [broadcastMsg, setBroadcastMsg] = useState("");

  const addResident = useMutation(api.people.addResident);
  const onboardEmployee = useMutation(api.people.onboardEmployee);
  const broadcastMessage = useMutation(api.people.broadcastMessage);

  const [residentLoading, setResidentLoading] = useState(false);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [broadcastLoading, setBroadcastLoading] = useState(false);

  // --- The rest of the dashboard remains unchanged ---
  const auditLogs = useQuery(api.settings.getAuditLogs, {}) || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Main column */}
      <div className="lg:col-span-2 space-y-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <h3 className="text-sm font-medium text-gray-500">Active Residents</h3>
            <p className="mt-1 text-3xl font-semibold text-gray-900">32</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <h3 className="text-sm font-medium text-gray-500">Active Staff</h3>
            <p className="mt-1 text-3xl font-semibold text-gray-900">45</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <h3 className="text-sm font-medium text-gray-500">Open Alerts</h3>
            <p className="mt-1 text-3xl font-semibold text-red-600">3</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <h3 className="text-sm font-medium text-gray-500">Kiosks Online</h3>
            <p className="mt-1 text-3xl font-semibold text-green-600">8</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold">Recent Activity</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {auditLogs.slice(0, 10).map((log: any) => (
                  <tr key={log.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{log.actorName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.event}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Side column */}
      <div className="space-y-8">
        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button
              className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              onClick={() => setShowResidentModal(true)}
            >
              Add New Resident
            </button>
            <button
              className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              onClick={() => setShowEmployeeModal(true)}
            >
              Onboard Employee
            </button>
            <button
              className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
              onClick={() => setShowBroadcastModal(true)}
            >
              Broadcast Message
            </button>
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h3 className="text-lg font-semibold mb-4">System Status</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between items-center">
              <span>Convex Database</span>
              <span className="font-semibold text-green-600">Operational</span>
            </li>
            <li className="flex justify-between items-center">
              <span>Authentication</span>
              <span className="font-semibold text-green-600">Operational</span>
            </li>
            <li className="flex justify-between items-center">
              <span>Email Service</span>
              <span className="font-semibold text-yellow-500">Degraded</span>
            </li>
            <li className="flex justify-between items-center">
              <span>Kiosk Network</span>
              <span className="font-semibold text-green-600">Operational</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Add Resident Modal */}
      {showResidentModal && (
        <Modal onClose={() => setShowResidentModal(false)} title="Add New Resident">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setResidentLoading(true);
              try {
                await addResident({
                  name: residentName,
                  location: residentLocation,
                  dob: residentDob || undefined,
                });
                setResidentName("");
                setResidentLocation("");
                setResidentDob("");
                setShowResidentModal(false);
              } finally {
                setResidentLoading(false);
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded"
                value={residentName}
                onChange={e => setResidentName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Location</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded"
                value={residentLocation}
                onChange={e => setResidentLocation(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded"
                value={residentDob}
                onChange={e => setResidentDob(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 bg-gray-200 rounded"
                onClick={() => setShowResidentModal(false)}
                disabled={residentLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded"
                disabled={residentLoading}
              >
                {residentLoading ? "Adding..." : "Add Resident"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Onboard Employee Modal */}
      {showEmployeeModal && (
        <Modal onClose={() => setShowEmployeeModal(false)} title="Onboard Employee">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setEmployeeLoading(true);
              try {
                await onboardEmployee({
                  name: employeeName,
                  email: employeeEmail,
                  role: employeeRole,
                  location: employeeLocation,
                });
                setEmployeeName("");
                setEmployeeEmail("");
                setEmployeeRole("staff");
                setEmployeeLocation("");
                setShowEmployeeModal(false);
              } finally {
                setEmployeeLoading(false);
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded"
                value={employeeName}
                onChange={e => setEmployeeName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                className="w-full px-3 py-2 border border-gray-300 rounded"
                value={employeeEmail}
                onChange={e => setEmployeeEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded"
                value={employeeRole}
                onChange={e => setEmployeeRole(e.target.value)}
              >
                <option value="staff">Staff</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Location</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded"
                value={employeeLocation}
                onChange={e => setEmployeeLocation(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 bg-gray-200 rounded"
                onClick={() => setShowEmployeeModal(false)}
                disabled={employeeLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded"
                disabled={employeeLoading}
              >
                {employeeLoading ? "Onboarding..." : "Onboard"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Broadcast Message Modal */}
      {showBroadcastModal && (
        <Modal onClose={() => setShowBroadcastModal(false)} title="Broadcast Message">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBroadcastLoading(true);
              try {
                await broadcastMessage({ message: broadcastMsg });
                setBroadcastMsg("");
                setShowBroadcastModal(false);
              } finally {
                setBroadcastLoading(false);
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700">Message</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded"
                value={broadcastMsg}
                onChange={e => setBroadcastMsg(e.target.value)}
                rows={4}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 bg-gray-200 rounded"
                onClick={() => setShowBroadcastModal(false)}
                disabled={broadcastLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded"
                disabled={broadcastLoading}
              >
                {broadcastLoading ? "Sending..." : "Send"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// Simple Modal component
function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-auto p-6 relative">
        <button
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <h2 className="text-xl font-semibold mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}
