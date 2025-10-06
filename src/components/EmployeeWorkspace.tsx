import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

// Role color mapping for badges
const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-800",
  supervisor: "bg-yellow-100 text-yellow-800",
  staff: "bg-green-100 text-green-800",
};

export default function EmployeeWorkspace() {
  const [selectedEmployees, setSelectedEmployees] = useState<Set<Id<"employees">>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    addRoles: [] as string[],
    removeRoles: [] as string[],
    addLocations: [] as string[],
    removeLocations: [] as string[],
  });

  // New Employee Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("staff");
  const [addLocations, setAddLocations] = useState<string[]>([]);
  const [addLoading, setAddLoading] = useState(false);

  const employees = useQuery(api.employees.listEmployees) || [];
  const locations = useQuery(api.employees.getAvailableLocations) || [];
  const bulkAssign = useMutation(api.employees.bulkAssignEmployees);
  const onboardEmployee = useMutation(api.people.onboardEmployee);

  const handleSelectEmployee = (employeeId: Id<"employees">, checked: boolean) => {
    const newSelected = new Set(selectedEmployees);
    if (checked) {
      newSelected.add(employeeId);
    } else {
      newSelected.delete(employeeId);
    }
    setSelectedEmployees(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmployees(new Set(employees.map(emp => emp.id)));
    } else {
      setSelectedEmployees(new Set());
    }
  };

  const handleBulkAssign = async () => {
    if (selectedEmployees.size === 0) return;
    try {
      const result = await bulkAssign({
        employeeIds: Array.from(selectedEmployees),
        addRoles: bulkForm.addRoles as any,
        removeRoles: bulkForm.removeRoles as any,
        addLocations: bulkForm.addLocations,
        removeLocations: bulkForm.removeLocations,
      });
      alert(`Updated ${result.changed} employees`);
      setSelectedEmployees(new Set());
      setShowBulkActions(false);
      setBulkForm({
        addRoles: [],
        removeRoles: [],
        addLocations: [],
        removeLocations: [],
      });
    } catch (err) {
      alert("Error: " + (err as Error).message);
    }
  };

  // Add New Employee handler
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    try {
      await onboardEmployee({
        name: addName,
        email: addEmail,
        role: addRole,
        locations: addLocations,
      });
      setAddName("");
      setAddEmail("");
      setAddRole("staff");
      setAddLocations([]);
      setShowAddModal(false);
    } catch (err) {
      alert("Failed to add employee: " + (err as Error).message);
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Add New Employee Button */}
      <div className="flex justify-end">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          onClick={() => setShowAddModal(true)}
        >
          Add New Employee
        </button>
      </div>

      {/* Bulk Actions Panel */}
      {selectedEmployees.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-blue-900">
              Bulk Actions ({selectedEmployees.size} selected)
            </h3>
            <button
              onClick={() => setShowBulkActions(!showBulkActions)}
              className="text-blue-600 hover:text-blue-800"
            >
              {showBulkActions ? "Hide" : "Show"} Options
            </button>
          </div>
          
          {showBulkActions && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Add Roles</label>
                  <select
                    multiple
                    value={bulkForm.addRoles}
                    onChange={(e) => setBulkForm(f => ({ ...f, addRoles: Array.from(e.target.selectedOptions, opt => opt.value) }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="admin">Admin</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Remove Roles</label>
                  <select
                    multiple
                    value={bulkForm.removeRoles}
                    onChange={(e) => setBulkForm(f => ({ ...f, removeRoles: Array.from(e.target.selectedOptions, opt => opt.value) }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="admin">Admin</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Add Locations</label>
                  <select
                    multiple
                    value={bulkForm.addLocations}
                    onChange={(e) => setBulkForm(f => ({ ...f, addLocations: Array.from(e.target.selectedOptions, opt => opt.value) }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    {locations.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Remove Locations</label>
                  <select
                    multiple
                    value={bulkForm.removeLocations}
                    onChange={(e) => setBulkForm(f => ({ ...f, removeLocations: Array.from(e.target.selectedOptions, opt => opt.value) }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    {locations.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setSelectedEmployees(new Set());
                    setShowBulkActions(false);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkAssign}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Apply Changes
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Employee List */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Employees</h3>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedEmployees.size === employees.length && employees.length > 0}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label className="text-sm text-gray-600">Select All</label>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Select
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Roles
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Locations
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invited
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.map((employee) => (
                <tr key={employee.id} className={selectedEmployees.has(employee.id) ? "bg-blue-50" : ""}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedEmployees.has(employee.id)}
                      onChange={(e) => handleSelectEmployee(employee.id, e.target.checked)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                      <div className="text-sm text-gray-500">{employee.workEmail}</div>
                      {employee.phone && (
                        <div className="text-sm text-gray-500">{employee.phone}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {employee.roles.map((role: string) => (
                        <span
                          key={role}
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[role] || "bg-gray-100 text-gray-800"}`}
                        >
                          {role}
                        </span>
                      ))}
                      {employee.roles.length === 0 && (
                        <span className="text-sm text-gray-400">No roles assigned</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {employee.locations.length > 0 ? employee.locations.join(", ") : "No locations"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      employee.employmentStatus === "active" ? "bg-green-100 text-green-800" :
                      employee.employmentStatus === "pending" ? "bg-yellow-100 text-yellow-800" :
                      "bg-red-100 text-red-800"
                    }`}>
                      {employee.employmentStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {employee.invitedAt ? new Date(employee.invitedAt).toLocaleDateString() : "Not invited"}
                    {employee.hasAcceptedInvite && (
                      <div className="text-green-600 text-xs">✓ Accepted</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add New Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-auto p-6 relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
              onClick={() => setShowAddModal(false)}
              aria-label="Close"
            >
              ×
            </button>
            <h2 className="text-xl font-semibold mb-4">Add New Employee</h2>
            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  value={addEmail}
                  onChange={e => setAddEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  value={addRole}
                  onChange={e => setAddRole(e.target.value)}
                >
                  <option value="staff">Staff</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="add-location-select">Location</label>
                <select
                  id="add-location-select"
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  value={addLocations.length > 0 ? addLocations[0] : ""}
                  onChange={e => setAddLocations(e.target.value ? [e.target.value] : [])}
                  required
                >
                  <option value="" disabled>Select a location</option>
                  {locations.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-200 rounded"
                  onClick={() => setShowAddModal(false)}
                  disabled={addLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                  disabled={addLoading}
                >
                  {addLoading ? "Adding..." : "Add Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
