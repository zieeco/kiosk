import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "isps", label: "ISPs" },
  { key: "guardian-checklists", label: "Guardian Checklists" },
  { key: "fire-evac-plans", label: "Fire Evac Plans" },
];

type StatusType = "ok" | "due-soon" | "overdue";

const STATUS_COLORS: Record<StatusType, string> = {
  ok: "text-green-600 bg-green-50",
  "due-soon": "text-orange-600 bg-orange-50",
  overdue: "text-red-600 bg-red-50",
};

const STATUS_ORDER: Record<StatusType, number> = { overdue: 0, "due-soon": 1, ok: 2 };

export default function ComplianceWorkspace() {
  const [activeTab, setActiveTab] = useState("overview");
  const [filters, setFilters] = useState({
    location: "",
    itemType: "",
    status: "",
  });
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const user = useQuery(api.auth.loggedInUser);
  const complianceData = useQuery(api.compliance.getComplianceOverview) || [];
  const guardianLinks = useQuery(api.compliance.getGuardianChecklistLinks) || [];
  const fireEvacPlans = useQuery(api.compliance.getFireEvacPlans) || [];

  const sendReminders = useMutation(api.compliance.sendComplianceReminders);
  const exportList = useMutation(api.compliance.exportComplianceList);
  const resendGuardianLink = useMutation(api.compliance.resendGuardianLink);

  // Get unique locations for filter
  const locations = useMemo(() => {
    const allLocations = [
      ...complianceData.map(item => item.location),
      ...guardianLinks.map(link => link.location),
      ...fireEvacPlans.map(plan => plan.location)
    ];
    return [...new Set(allLocations)].sort();
  }, [complianceData, guardianLinks, fireEvacPlans]);

  const handleBulkAction = async (action: string) => {
    if (selectedItems.length === 0) return;

    try {
      if (action === "send-reminders") {
        await sendReminders({ itemIds: selectedItems });
        alert(`Reminders sent for ${selectedItems.length} items`);
      } else if (action === "export") {
        await exportList({ itemIds: selectedItems });
        alert(`Exported ${selectedItems.length} items`);
      }
      setSelectedItems([]);
    } catch (error) {
      console.error("Bulk action failed:", error);
      alert("Action failed. Please try again.");
    }
  };

  const filteredComplianceData = useMemo(() => {
    return complianceData.filter(item => {
      if (filters.location && item.location !== filters.location) return false;
      if (filters.itemType && item.type !== filters.itemType) return false;
      if (filters.status && item.status !== filters.status) return false;
      return true;
    }).sort((a, b) => STATUS_ORDER[a.status as StatusType] - STATUS_ORDER[b.status as StatusType]);
  }, [complianceData, filters]);

  const filteredGuardianLinks = useMemo(() => {
    return guardianLinks.filter(link => {
      if (filters.location && link.location !== filters.location) return false;
      return true;
    });
  }, [guardianLinks, filters]);

  const filteredFireEvacPlans = useMemo(() => {
    return fireEvacPlans.filter(plan => {
      if (filters.location && plan.location !== filters.location) return false;
      if (filters.status && plan.status !== filters.status) return false;
      return true;
    }).sort((a, b) => STATUS_ORDER[a.status as StatusType] - STATUS_ORDER[b.status as StatusType]);
  }, [fireEvacPlans, filters]);

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <select
              value={filters.location}
              onChange={(e) => setFilters({ ...filters, location: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Locations</option>
              {locations.map(location => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Item Type
            </label>
            <select
              value={filters.itemType}
              onChange={(e) => setFilters({ ...filters, itemType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="isp">ISP</option>
              <option value="fire_evac">Fire Evac Plan</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="overdue">Overdue</option>
              <option value="due-soon">Due Soon</option>
              <option value="ok">OK</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ location: "", itemType: "", status: "" })}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedItems.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-700">
              {selectedItems.length} items selected
            </span>
            <div className="space-x-2">
              <button
                onClick={() => handleBulkAction("send-reminders")}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Send Reminders
              </button>
              <button
                onClick={() => handleBulkAction("export")}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                Export List
              </button>
              <button
                onClick={() => setSelectedItems([])}
                className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compliance Items Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Compliance Items</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedItems.length === filteredComplianceData.length && filteredComplianceData.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedItems(filteredComplianceData.map(item => item.id));
                      } else {
                        setSelectedItems([]);
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredComplianceData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedItems([...selectedItems, item.id]);
                        } else {
                          setSelectedItems(selectedItems.filter(id => id !== item.id));
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{item.itemName}</div>
                      <div className="text-sm text-gray-500">{item.description}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.location}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[item.status as StatusType]}`}>
                      {item.status === "due-soon" ? "Due Soon" : item.status === "overdue" ? "Overdue" : "OK"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(item.dueDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.lastAction}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredComplianceData.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No compliance items found matching your filters.
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderGuardianChecklists = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Guardian Checklist Links</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Template
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sent Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expires
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredGuardianLinks.map((link) => (
                <tr key={link.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {link.location}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {link.templateName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      link.completed ? "text-green-600 bg-green-50" :
                      link.expired ? "text-red-600 bg-red-50" :
                      "text-yellow-600 bg-yellow-50"
                    }`}>
                      {link.completed ? "Completed" : link.expired ? "Expired" : "Pending"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(link.sentDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(link.expiresAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {!link.completed && (
                      <button
                        onClick={() => resendGuardianLink({ linkId: link.id as Id<"guardian_checklist_links"> })}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Resend
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredGuardianLinks.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No guardian checklist links found.
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderFireEvacPlans = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Fire Evacuation Plans</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Version
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Upload
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Next Due
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredFireEvacPlans.map((plan) => (
                <tr key={plan.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {plan.location}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    v{plan.version}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[plan.status as StatusType]}`}>
                      {plan.status === "due-soon" ? "Due Soon" : plan.status === "overdue" ? "Overdue" : "OK"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(plan.lastUpload).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(plan.nextDue).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredFireEvacPlans.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No fire evacuation plans found.
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8" aria-label="Tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && renderOverview()}
      {activeTab === "isps" && (
        <div className="text-center py-8 text-gray-500">
          ISP management is available in the People workspace.
        </div>
      )}
      {activeTab === "guardian-checklists" && renderGuardianChecklists()}
      {activeTab === "fire-evac-plans" && renderFireEvacPlans()}
    </div>
  );
}
