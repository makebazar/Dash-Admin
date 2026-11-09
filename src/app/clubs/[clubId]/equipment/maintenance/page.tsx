"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Loader2,
  Shirt,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PageShell } from "@/components/layout/PageShell";
import Link from "next/link";
import { MaintenanceSegmentedBar } from "@/components/equipment/MaintenanceSegmentedBar";
import { getMaintenanceProgress } from "@/lib/maintenance-progress";

interface MaintenanceTask {
  is_available_to_all?: boolean;
  equipment_is_available_to_all?: boolean;
  id: string;
  equipment_id: string;
  equipment_name: string;
  equipment_type: string;
  equipment_type_name: string;
  equipment_icon: string;
  last_cleaned_at: string | null;
  workstation_id: string | null;
  workstation_name: string | null;
  workstation_zone: string | null;
  equipment_assignment_mode?: "DIRECT" | "INHERIT" | "FREE_POOL";
  equipment_assigned_user_id?: string | null;
  workstation_assigned_user_id?: string | null;
  workstation_assigned_to_name?: string | null;
  workstation_is_available_to_all?: boolean;
  assigned_user_id: string | null;
  assigned_to_name: string | null;
  due_date: string;
  overdue_days?: number;
  rework_days?: number;
  verification_status?: "PENDING" | "APPROVED" | "REJECTED" | null;
  verified_at?: string | null;
  rejection_reason?: string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED" | "REWORK";
  completed_at: string | null;
  completed_by_name: string | null;
  task_type: string;
}

interface Employee {
  id: string;
  full_name: string;
  role?: string | null;
  is_active?: boolean;
  dismissed_at?: string | null;
  show_in_schedule?: boolean;
}

interface EquipmentListItem {
  id: string;
  workstation_id: string | null;
  workstation_name: string | null;
  workstation_zone: string | null;
  workstation_assigned_user_id?: string | null;
  workstation_assigned_to_name?: string | null;
  workstation_is_available_to_all?: boolean;
  is_available_to_all?: boolean;
  equipment_is_available_to_all?: boolean;
  type: string;
  type_icon?: string | null;
  name: string;
  type_name: string | null;
  last_cleaned_at: string | null;
  cleaning_interval_days: number | null;
  maintenance_enabled: boolean | null;
  parent_equipment_id?: string | null;
  assigned_user_id: string | null;
  assigned_to_name?: string | null;
  assignment_mode?: "DIRECT" | "INHERIT" | "FREE_POOL" | null;
}

interface PlaceGroup {
  key: string;
  workstationId: string | null;
  zone: string;
  name: string;
  assignedUserId: string | null;
  assignedToName: string | null;
  isAvailableToAll?: boolean;
  devices: DeviceGroup[];
  overdue: number;
  today: number;
  inProgress: number;
  rework: number;
  future: number;
  completed: number;
}

interface DeviceGroup {
  key: string;
  equipmentId: string;
  equipmentName: string;
  equipmentType: string;
  equipmentTypeName: string;
  equipmentTypeIcon?: string | null;
  lastCleanedAt: string | null;
  cleaningIntervalDays?: number | null;
  maintenanceEnabled?: boolean | null;
  isAvailableToAll: boolean;
  assignmentMode: "DIRECT" | "INHERIT" | "FREE_POOL";
  assignedUserId: string | null;
  assignedToName: string | null;
  effectiveAssignedUserId: string | null;
  effectiveAssignedToName: string | null;
  inheritedAssignedUserId: string | null;
  inheritedAssignedToName: string | null;
  activeTasks: MaintenanceTask[];
  overdue: number;
  today: number;
  inProgress: number;
  rework: number;
  future: number;
  completed: number;
  nextDueDate: string | null;
}

interface ZoneGroup {
  key: string;
  name: string;
  overdue: number;
  today: number;
  inProgress: number;
  rework: number;
  future: number;
  responsibles: string[];
  freePoolCount: number;
  places: PlaceGroup[];
}

const getLocalDateKey = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDay = (value?: string | null) => {
  if (!value) return "—";

  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00`
    : value;

  const parsed = new Date(normalizedValue);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
};

const normalizeAssignmentMode = (
  mode?: "DIRECT" | "INHERIT" | "FREE_POOL" | null,
) => {
  if (mode === "DIRECT" || mode === "FREE_POOL") return mode;
  return "INHERIT";
};

const calculateNextDueDate = (
  lastCleanedAt?: string | null,
  intervalDays?: number | null,
) => {
  if (!intervalDays || intervalDays < 1) return null;

  if (!lastCleanedAt) return null;

  const parsed = new Date(lastCleanedAt);
  if (Number.isNaN(parsed.getTime())) return null;

  parsed.setHours(0, 0, 0, 0);
  parsed.setDate(parsed.getDate() + intervalDays);

  return getLocalDateKey(parsed);
};

export default function MaintenanceSchedule() {
  const { clubId } = useParams();
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [equipment, setEquipment] = useState<EquipmentListItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
  const [expandedPlaces, setExpandedPlaces] = useState<Set<string>>(new Set());

  const assignableEmployees = useMemo(() => {
    const isManagerRole = (employee: Employee) => {
      const role = String(employee.role || "").toLowerCase();
      return role.includes("управ") || role.includes("manager");
    };

    const isActiveEmployee = (employee: Employee) =>
      employee.is_active !== false && !employee.dismissed_at;
    const isScheduledEmployee = (employee: Employee) =>
      isActiveEmployee(employee) && employee.show_in_schedule !== false;

    return employees.filter(
      (employee) =>
        isScheduledEmployee(employee) ||
        (isManagerRole(employee) && isActiveEmployee(employee)),
    );
  }, [employees]);

  const getEmployeeRoleTextClass = (employee: Employee) => {
    const role = String(employee.role || "").toLowerCase();

    if (role.includes("управ") || role.includes("manager")) {
      return "text-violet-600 font-medium";
    }

    if (employee.show_in_schedule !== false) {
      return "text-emerald-600 font-medium";
    }

    return "text-slate-400 font-normal";
  };

  const ensurePlan = useCallback(
    async (firstDay: string, lastDay: string) => {
      const res = await fetch(`/api/clubs/${clubId}/equipment/maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date_from: firstDay,
          date_to: lastDay,
          task_type: "CLEANING",
        }),
      });
      if (!res.ok) return 0;
      const data = await res.json();
      return Number(data.created_tasks || 0);
    },
    [clubId],
  );

  const loadScheduleData = useCallback(
    async (firstDay: string, lastDay: string) => {
      const [tasksRes, employeesRes, equipmentRes] = await Promise.all([
        fetch(
          `/api/clubs/${clubId}/equipment/maintenance?date_from=${firstDay}&date_to=${lastDay}&include_overdue=true`,
        ),
        fetch(`/api/clubs/${clubId}/employees`),
        fetch(`/api/clubs/${clubId}/equipment?limit=5000`),
      ]);

      const [tasksData, employeesData, equipmentData] = await Promise.all([
        tasksRes.json(),
        employeesRes.json(),
        equipmentRes.json(),
      ]);

      const allEquipment = equipmentData.equipment || [];
      const nonComponentEquipment = allEquipment.filter(
        (e: any) => !e.parent_equipment_id,
      );

      const allTasks = tasksData.tasks || [];
      const nonComponentTasks = allTasks.filter((t: any) => {
        const eq = allEquipment.find((e: any) => e.id === t.equipment_id);
        return !eq?.parent_equipment_id;
      });

      if (tasksRes.ok) setTasks(nonComponentTasks);
      if (employeesRes.ok) setEmployees(employeesData.employees || []);
      if (equipmentRes.ok) setEquipment(nonComponentEquipment);
    },
    [clubId],
  );

  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true);
      try {
        const now = new Date();
        const firstDay = getLocalDateKey(
          new Date(now.getFullYear(), now.getMonth(), 1),
        );
        const lastDay = getLocalDateKey(
          new Date(now.getFullYear(), now.getMonth() + 1, 0),
        );

        await loadScheduleData(firstDay, lastDay);
        if (!silent) setIsLoading(false);

        const created = await ensurePlan(firstDay, lastDay);
        if (created > 0) {
          await loadScheduleData(firstDay, lastDay);
        }
      } catch (error) {
        console.error("Error fetching maintenance data:", error);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [ensurePlan, loadScheduleData],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAssignEquipment = async (equipmentId: string, value: string) => {
    const isFree = value === "free_pool" || value === "unassigned" || value === "none";
    const assignmentMode = isFree ? "FREE_POOL" : "DIRECT";

    const assignedUserId = isFree ? null : value;
    const assignedToName = assignedUserId
      ? employees.find((employee) => employee.id === assignedUserId)
          ?.full_name || null
      : null;

    setTasks((prev) =>
      prev.map((task) =>
        task.equipment_id === equipmentId
          ? {
              ...task,
              equipment_assignment_mode: assignmentMode,
              equipment_assigned_user_id: assignedUserId,
              assigned_user_id: assignedUserId,
              assigned_to_name: assignedToName,
            }
          : task,
      ),
    );

    setEquipment((prev) =>
      prev.map((item) =>
        item.id === equipmentId
          ? {
              ...item,
              assignment_mode: assignmentMode,
              assigned_user_id: assignedUserId,
              assigned_to_name: assignedToName,
            }
          : item,
      ),
    );

    try {
      await fetch(`/api/clubs/${clubId}/equipment/${equipmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignment_mode: assignmentMode,
          assigned_user_id: assignedUserId,
          maintenance_enabled: true,
        }),
      });
      fetchData(true);
    } catch (error) {
      console.error("Error assigning equipment owner:", error);
      fetchData(true);
    }
  };

  const handleResetTask = async (taskId: string) => {
    try {
      await fetch(`/api/clubs/${clubId}/equipment/maintenance/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PENDING" }),
      });
      fetchData(true);
    } catch (error) {
      console.error("Error resetting task:", error);
      fetchData(true);
    }
  };


  const filteredEquipment = useMemo(() => {
    return equipment.filter((item) => {
      if (item.maintenance_enabled === false) return false;
      if (item.parent_equipment_id) return false;
      return true;
    });
  }, [equipment]);

  const filteredEquipmentIds = useMemo(
    () => new Set(filteredEquipment.map((item) => item.id)),
    [filteredEquipment],
  );

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => filteredEquipmentIds.has(task.equipment_id));
  }, [filteredEquipmentIds, tasks]);

  const employeeDistribution = useMemo(() => {
    const workload = new Map<
      string,
      {
        id: string;
        fullName: string;
        places: Set<string>;
        devices: Set<string>;
      }
    >();

    filteredEquipment.forEach((item) => {
      const assignmentMode = normalizeAssignmentMode(item.assignment_mode);
      const effectiveAssignedUserId =
        assignmentMode === "DIRECT"
          ? item.assigned_user_id
          : assignmentMode === "FREE_POOL"
            ? null
            : item.workstation_assigned_user_id || null;

      if (!effectiveAssignedUserId) return;

      const fullName =
        (assignmentMode === "DIRECT"
          ? item.assigned_to_name
          : item.workstation_assigned_to_name) ||
        employees.find((employee) => employee.id === effectiveAssignedUserId)
          ?.full_name ||
        "Без имени";

      if (!workload.has(effectiveAssignedUserId)) {
        workload.set(effectiveAssignedUserId, {
          id: effectiveAssignedUserId,
          fullName,
          places: new Set<string>(),
          devices: new Set<string>(),
        });
      }

      const employeeLoad = workload.get(effectiveAssignedUserId)!;
      employeeLoad.places.add(
        `${item.workstation_id || "storage"}::${item.workstation_zone || "Без зоны"}::${item.workstation_name || "Склад"}`,
      );
      employeeLoad.devices.add(item.id);
    });

    return Array.from(workload.values())
      .map((employee) => ({
        id: employee.id,
        fullName: employee.fullName,
        placesCount: employee.places.size,
        devicesCount: employee.devices.size,
      }))
      .sort((a, b) => {
        const devicesDiff = b.devicesCount - a.devicesCount;
        if (devicesDiff !== 0) return devicesDiff;
        const placesDiff = b.placesCount - a.placesCount;
        if (placesDiff !== 0) return placesDiff;
        return a.fullName.localeCompare(b.fullName);
      });
  }, [employees, filteredEquipment]);

  const freePoolDistribution = useMemo(() => {
    const places = new Set<string>();
    const devices = new Set<string>();

    filteredEquipment.forEach((item) => {
      const assignmentMode = normalizeAssignmentMode(item.assignment_mode);
      const effectiveAssignedUserId =
        assignmentMode === "DIRECT"
          ? item.assigned_user_id
          : assignmentMode === "FREE_POOL"
            ? null
            : item.workstation_assigned_user_id || null;

      const placeKey = `${item.workstation_id || "storage"}::${item.workstation_zone || "Без зоны"}::${item.workstation_name || "Склад"}`;

      if (!item.workstation_assigned_user_id) {
        places.add(placeKey);
      }

      if (!effectiveAssignedUserId) {
        devices.add(item.id);
      }
    });

    return {
      placesCount: places.size,
      devicesCount: devices.size,
    };
  }, [filteredEquipment]);

  const zones = useMemo(() => {
    const todayKey = getLocalDateKey();
    const zoneMap = new Map<string, ZoneGroup>();

    filteredEquipment.forEach((item) => {
      const zoneName = item.workstation_zone || "Без зоны";
      const placeName = item.workstation_name || "Склад";
      const zoneKey = zoneName;
      const placeKey = `${zoneName}::${placeName}`;

      if (!zoneMap.has(zoneKey)) {
        zoneMap.set(zoneKey, {
          key: zoneKey,
          name: zoneName,
          overdue: 0,
          today: 0,
          inProgress: 0,
          rework: 0,
          future: 0,
          responsibles: [],
          freePoolCount: 0,
          places: [],
        });
      }

      const zone = zoneMap.get(zoneKey)!;

      const assignmentMode = normalizeAssignmentMode(item.assignment_mode);
      const effectiveAssignedUserId =
        assignmentMode === "DIRECT"
          ? item.assigned_user_id
          : assignmentMode === "FREE_POOL"
            ? null
            : item.workstation_assigned_user_id || null;
      const effectiveAssignedToName =
        assignmentMode === "DIRECT"
          ? item.assigned_to_name || null
          : assignmentMode === "FREE_POOL"
            ? null
            : item.workstation_assigned_to_name || null;

      if (
        effectiveAssignedToName &&
        !zone.responsibles.includes(effectiveAssignedToName)
      ) {
        zone.responsibles.push(effectiveAssignedToName);
      }

      if (!effectiveAssignedUserId) {
        zone.freePoolCount += 1;
      }

      let place = zone.places.find(
        (existingPlace) => existingPlace.key === placeKey,
      );

      if (!place) {
        place = {
          key: placeKey,
          workstationId: item.workstation_id,
          zone: zoneName,
          name: placeName,
          assignedUserId: item.workstation_assigned_user_id || null,
          assignedToName: item.workstation_assigned_to_name || null,
          isAvailableToAll: Boolean(item.workstation_is_available_to_all),
          devices: [],
          overdue: 0,
          today: 0,
          inProgress: 0,
          rework: 0,
          future: 0,
          completed: 0,
        };
        zone.places.push(place);
      }

      const isAvailableToAll =
        item.equipment_is_available_to_all !== null &&
        item.equipment_is_available_to_all !== undefined
          ? Boolean(item.equipment_is_available_to_all)
          : Boolean(item.workstation_is_available_to_all);

      place.devices.push({
        key: `${placeKey}::${item.id}`,
        equipmentId: item.id,
        equipmentName: item.name,
        equipmentType: item.type,
        equipmentTypeName: item.type_name || item.type,
        equipmentTypeIcon: item.type_icon || null,
        lastCleanedAt: item.last_cleaned_at,
        cleaningIntervalDays: item.cleaning_interval_days,
        maintenanceEnabled: item.maintenance_enabled !== false,
        isAvailableToAll,
        assignmentMode,
        assignedUserId: item.assigned_user_id,
        assignedToName:
          assignmentMode === "DIRECT" ? item.assigned_to_name || null : null,
        effectiveAssignedUserId,
        effectiveAssignedToName,
        inheritedAssignedUserId: item.workstation_assigned_user_id || null,
        inheritedAssignedToName: item.workstation_assigned_to_name || null,
        activeTasks: [],
        overdue: 0,
        today: 0,
        inProgress: 0,
        rework: 0,
        future: 0,
        completed: 0,
        nextDueDate: calculateNextDueDate(
          item.last_cleaned_at,
          item.cleaning_interval_days,
        ),
      });
    });

    filteredTasks.forEach((task) => {
      const zoneName = task.workstation_zone || "Без зоны";
      const placeName = task.workstation_name || "Склад";
      const zoneKey = zoneName;
      const placeKey = `${zoneName}::${placeName}`;

      if (!zoneMap.has(zoneKey)) {
        zoneMap.set(zoneKey, {
          key: zoneKey,
          name: zoneName,
          overdue: 0,
          today: 0,
          inProgress: 0,
          rework: 0,
          future: 0,
          responsibles: [],
          freePoolCount: 0,
          places: [],
        });
      }

      const zone = zoneMap.get(zoneKey)!;
      if (
        task.assigned_to_name &&
        !zone.responsibles.includes(task.assigned_to_name)
      ) {
        zone.responsibles.push(task.assigned_to_name);
      }
      let place = zone.places.find((item) => item.key === placeKey);

      if (!place) {
        place = {
          key: placeKey,
          workstationId: task.workstation_id,
          zone: zoneName,
          name: placeName,
          assignedUserId: task.workstation_assigned_user_id || null,
          assignedToName: task.workstation_assigned_to_name || null,
          isAvailableToAll: Boolean(task.workstation_is_available_to_all),
          devices: [],
          overdue: 0,
          today: 0,
          inProgress: 0,
          rework: 0,
          future: 0,
          completed: 0,
        };
        zone.places.push(place);
      } else {
        if (
          task.workstation_assigned_user_id ||
          task.workstation_assigned_to_name
        ) {
          place.assignedUserId = task.workstation_assigned_user_id || null;
          place.assignedToName = task.workstation_assigned_to_name || null;
        }
        if (task.workstation_is_available_to_all !== undefined) {
          place.isAvailableToAll = Boolean(task.workstation_is_available_to_all);
        }
      }

      let device = place.devices.find(
        (item) => item.equipmentId === task.equipment_id,
      );

      if (!device) {
        const matchedEq = equipment.find((e) => e.id === task.equipment_id);
        device = {
          key: `${placeKey}::${task.equipment_id}`,
          equipmentId: task.equipment_id,
          equipmentName: task.equipment_name,
          equipmentType: task.equipment_type || matchedEq?.type || "OTHER",
          equipmentTypeName: task.equipment_type_name || matchedEq?.type_name || task.equipment_type || "Оборудование",
          equipmentTypeIcon: task.equipment_icon || matchedEq?.type_icon || null,
          lastCleanedAt: task.last_cleaned_at,
          cleaningIntervalDays: matchedEq?.cleaning_interval_days ?? null,
          maintenanceEnabled: matchedEq ? matchedEq.maintenance_enabled !== false : true,
          isAvailableToAll:
            task.equipment_is_available_to_all !== null && task.equipment_is_available_to_all !== undefined
              ? Boolean(task.equipment_is_available_to_all)
              : Boolean(task.workstation_is_available_to_all),
          assignmentMode: (task.equipment_assignment_mode || "DIRECT") as
            | "DIRECT"
            | "INHERIT"
            | "FREE_POOL",
          assignedUserId: task.equipment_assigned_user_id || null,
          assignedToName:
            task.equipment_assignment_mode === "DIRECT"
              ? task.assigned_to_name
              : null,
          effectiveAssignedUserId: task.assigned_user_id,
          effectiveAssignedToName: task.assigned_to_name,
          inheritedAssignedUserId: task.workstation_assigned_user_id || null,
          inheritedAssignedToName: task.workstation_assigned_to_name || null,
          activeTasks: [],
          overdue: 0,
          today: 0,
          inProgress: 0,
          rework: 0,
          future: 0,
          completed: 0,
          nextDueDate: task.due_date,
        };
        place.devices.push(device);
      } else if (
        task.assigned_user_id ||
        task.assigned_to_name ||
        task.workstation_assigned_user_id ||
        task.workstation_assigned_to_name
      ) {
        device.assignmentMode = (task.equipment_assignment_mode ||
          device.assignmentMode) as "DIRECT" | "INHERIT" | "FREE_POOL";
        device.assignedUserId = task.equipment_assigned_user_id || null;
        device.assignedToName =
          task.equipment_assignment_mode === "DIRECT"
            ? task.assigned_to_name
            : null;
        device.effectiveAssignedUserId = task.assigned_user_id;
        device.effectiveAssignedToName = task.assigned_to_name;
        device.inheritedAssignedUserId =
          task.workstation_assigned_user_id || null;
        device.inheritedAssignedToName =
          task.workstation_assigned_to_name || null;
      }

      // Если задача выполнена или дата задачи предшествует дате последней чистки,
      // значит устройство уже обслужено и старый план закрыт.
      const isTaskAlreadyCleaned = Boolean(
        device.lastCleanedAt &&
          task.due_date <= device.lastCleanedAt &&
          task.status !== "REWORK" &&
          task.status !== "IN_PROGRESS",
      );

      const isTaskObsolete = task.status === "COMPLETED" || isTaskAlreadyCleaned;

      if (!isTaskObsolete) {
        if (!device.nextDueDate || task.due_date < device.nextDueDate) {
          device.nextDueDate = task.due_date;
        }
      }

      if (
        task.status === "REWORK" ||
        (task.status === "IN_PROGRESS" &&
          task.verification_status === "REJECTED")
      ) {
        zone.rework++;
        place.rework++;
        device.rework++;
      }

      if (task.status === "IN_PROGRESS" || task.status === "REWORK") {
        if (task.status === "IN_PROGRESS") {
          zone.inProgress++;
          place.inProgress++;
          device.inProgress++;
        }
        device.activeTasks.push(task);
        return;
      }

      if (task.status === "COMPLETED") {
        place.completed++;
        device.completed++;
        return;
      }

      if (task.due_date < todayKey) {
        if (isTaskAlreadyCleaned) {
          // Оборудование уже обслужено после даты этой задачи
          return;
        }
        zone.overdue++;
        place.overdue++;
        device.overdue++;
        device.activeTasks.push(task);
        return;
      }

      if (task.due_date === todayKey) {
        zone.today++;
        place.today++;
        device.today++;
        device.activeTasks.push(task);
        return;
      }

      zone.future++;
      place.future++;
      device.future++;
    });

    return Array.from(zoneMap.values())
      .map((zone) => ({
        ...zone,
        places: zone.places
          .map((place) => ({
            ...place,
            devices: place.devices.sort((a, b) => {
              const activeDiff =
                b.overdue +
                b.today +
                b.inProgress -
                (a.overdue + a.today + a.inProgress);
              if (activeDiff !== 0) return activeDiff;
              const futureDiff = b.future - a.future;
              if (futureDiff !== 0) return futureDiff;
              return a.equipmentName.localeCompare(b.equipmentName);
            }),
          }))
          .sort((a, b) => {
            const activeDiff =
              b.overdue +
              b.today +
              b.inProgress -
              (a.overdue + a.today + a.inProgress);
            if (activeDiff !== 0) return activeDiff;
            const futureDiff = b.future - a.future;
            if (futureDiff !== 0) return futureDiff;
            return a.name.localeCompare(b.name);
          }),
      }))
      .sort((a, b) => {
        const activeDiff =
          b.overdue +
          b.today +
          b.inProgress -
          (a.overdue + a.today + a.inProgress);
        if (activeDiff !== 0) return activeDiff;
        const futureDiff = b.future - a.future;
        if (futureDiff !== 0) return futureDiff;
        return a.name.localeCompare(b.name);
      });
  }, [filteredEquipment, filteredTasks]);


  const toggleZone = (zoneKey: string) => {
    setExpandedZones((prev) => {
      if (prev.has(zoneKey)) {
        setExpandedPlaces(new Set());
        return new Set();
      }
      setExpandedPlaces(new Set());
      return new Set([zoneKey]);
    });
  };

  const togglePlace = (placeKey: string) => {
    setExpandedPlaces((prev) =>
      prev.has(placeKey) ? new Set() : new Set([placeKey]),
    );
  };

  const handleAssignPlace = async (
    workstationId: string | null,
    userId: string,
  ) => {
    if (!workstationId) return;

    const assignedUserId =
      userId === "none" || userId === "unassigned" || userId === "free_pool"
        ? null
        : userId;
    const assignedToName = assignedUserId
      ? employees.find((employee) => employee.id === assignedUserId)
          ?.full_name || null
      : null;
    const nextAssignmentMode = assignedUserId ? "DIRECT" : "FREE_POOL";

    setTasks((prev) =>
      prev.map((task) =>
        task.workstation_id === workstationId
          ? {
              ...task,
              workstation_assigned_user_id: assignedUserId,
              workstation_assigned_to_name: assignedToName,
              equipment_assignment_mode: nextAssignmentMode,
              equipment_assigned_user_id: assignedUserId,
              assigned_user_id: assignedUserId,
              assigned_to_name: assignedToName,
            }
          : task,
      ),
    );

    setEquipment((prev) =>
      prev.map((item) =>
        item.workstation_id === workstationId
          ? {
              ...item,
              workstation_assigned_user_id: assignedUserId,
              workstation_assigned_to_name: assignedToName,
              assignment_mode: nextAssignmentMode,
              assigned_user_id: assignedUserId,
              assigned_to_name: assignedToName,
            }
          : item,
      ),
    );

    try {
      await fetch(`/api/clubs/${clubId}/workstations/${workstationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assigned_user_id: assignedUserId,
          free_pool: assignedUserId === null,
        }),
      });
      fetchData(true);
    } catch (error) {
      console.error("Error assigning place owner:", error);
      fetchData(true);
    }
  };

  const handleToggleDeviceAvailableToAll = async (
    equipmentId: string,
    checked: boolean,
  ) => {
    setEquipment((prev) =>
      prev.map((item) =>
        item.id === equipmentId
          ? {
              ...item,
              is_available_to_all: checked,
              equipment_is_available_to_all: checked,
            }
          : item,
      ),
    );

    setTasks((prev) =>
      prev.map((task) =>
        task.equipment_id === equipmentId
          ? {
              ...task,
              is_available_to_all: checked,
              equipment_is_available_to_all: checked,
            }
          : task,
      ),
    );

    try {
      await fetch(`/api/clubs/${clubId}/equipment/${equipmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_available_to_all: checked }),
      });
      fetchData(true);
    } catch (error) {
      console.error("Error toggling device available to all:", error);
      fetchData(true);
    }
  };

  const handleToggleAvailableToAll = async (
    workstationId: string | null,
    checked: boolean,
  ) => {
    if (!workstationId) return;

    setTasks((prev) =>
      prev.map((task) =>
        task.workstation_id === workstationId
          ? {
              ...task,
              workstation_is_available_to_all: checked,
              is_available_to_all: checked,
              equipment_is_available_to_all: checked,
            }
          : task,
      ),
    );

    setEquipment((prev) =>
      prev.map((item) =>
        item.workstation_id === workstationId
          ? {
              ...item,
              workstation_is_available_to_all: checked,
              is_available_to_all: checked,
              equipment_is_available_to_all: checked,
            }
          : item,
      ),
    );

    try {
      await fetch(`/api/clubs/${clubId}/workstations/${workstationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_available_to_all: checked }),
      });
      fetchData(true);
    } catch (error) {
      console.error("Error toggling available to all:", error);
      fetchData(true);
    }
  };

  const getDeviceAssignmentMeta = (device: DeviceGroup, place: PlaceGroup) => {
    const resolvedAssignedUserId =
      device.assignmentMode === "DIRECT"
        ? device.assignedUserId
        : device.effectiveAssignedUserId;
    const resolvedAssignedToName =
      device.assignmentMode === "DIRECT"
        ? device.assignedToName
        : device.effectiveAssignedToName;

    if (!resolvedAssignedUserId) {
      return {
        selectValue: "free_pool",
        badgeLabel: null,
        badgeClass: "",
        ownerLabel: "Свободный пул",
      };
    }

    if (
      place.assignedUserId &&
      resolvedAssignedUserId &&
      place.assignedUserId !== resolvedAssignedUserId
    ) {
      return {
        selectValue: resolvedAssignedUserId,
        badgeLabel: "Свой ответственный",
        badgeClass: "text-amber-600 font-medium",
        ownerLabel: resolvedAssignedToName || "Свободный пул",
      };
    }

    return {
      selectValue: resolvedAssignedUserId || "free_pool",
      badgeLabel: null,
      badgeClass: "",
      ownerLabel: resolvedAssignedToName || "Свободный пул",
    };
  };

  return (
    <PageShell maxWidth="7xl">
      <div className="space-y-8 pb-28 sm:pb-12">
        {/* Header Section */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">
            <div className="min-w-0">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 truncate">
                Обслуживание
              </h1>
              <p className="text-slate-500 text-lg mt-2">
                График чистки, исполнители и регламентный контроль состояния техники
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
              <Button
                asChild
                variant="outline"
                className="w-full sm:w-auto rounded-xl h-11 px-6 font-medium"
              >
                <Link href={`/clubs/${clubId}/laundry`}>
                  <Shirt className="mr-2 h-4 w-4" />
                  Стирка
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full sm:w-auto rounded-xl h-11 px-6 font-medium"
              >
                <Link href={`/clubs/${clubId}/equipment`}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Назад
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Employee Distribution Card (DashFrag Style) */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 uppercase tracking-tight">
                Распределение по сотрудникам
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Закрепленные места и оборудование для регламентной чистки
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-slate-900">
                {employeeDistribution.length}
              </div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                Назначено
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {employeeDistribution.length > 0 ? (
              employeeDistribution.map((employee) => (
                <div
                  key={employee.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      {employee.fullName}
                    </div>
                    <div className="text-xs text-slate-400 font-medium mt-0.5">
                      {employee.placesCount} мест · {employee.devicesCount} устр.
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-semibold text-slate-700 bg-white border border-slate-200/80 px-2.5 py-1 rounded-xl shadow-2xs">
                      {employee.devicesCount} устр.
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400 font-medium">
                Нет назначений по текущему фильтру
              </div>
            )}

            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 p-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-bold text-slate-700 truncate">
                  Свободный пул
                </div>
                <div className="text-xs text-slate-400 font-medium mt-0.5">
                  {freePoolDistribution.placesCount} мест · {freePoolDistribution.devicesCount} устр.
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-xl">
                  {freePoolDistribution.devicesCount} устр.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Zones & Maintenance Content */}
        {isLoading ? (
          <div className="border border-slate-200 rounded-3xl bg-white shadow-xs">
            <div className="h-64 flex items-center justify-center text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          </div>
        ) : zones.length === 0 ? (
          <div className="border border-slate-200 rounded-3xl bg-white shadow-xs">
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Calendar className="h-8 w-8 opacity-40" />
              <div className="text-xs font-bold uppercase tracking-wider">Ничего не найдено</div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {zones.map((zone) => {
              const isZoneOpen = expandedZones.has(zone.key);

              return (
                <div
                  key={zone.key}
                  className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleZone(zone.key)}
                    className="w-full px-6 py-4.5 bg-slate-50/50 border-b border-slate-100 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2.5">
                          <ChevronRight
                            className={cn(
                              "h-4 w-4 text-slate-400 transition-transform",
                              isZoneOpen && "rotate-90",
                            )}
                          />
                          <div className="text-base font-bold text-slate-900">
                            {zone.name}
                          </div>
                          <span className="text-xs font-medium text-slate-400">
                            • {zone.places.length} мест
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 font-medium pl-6 flex flex-wrap items-center gap-1.5">
                          <span>Ответственные:</span>
                          <span className="text-slate-700">
                            {zone.responsibles.length > 0
                              ? zone.responsibles.slice(0, 4).join(", ") +
                                (zone.responsibles.length > 4
                                  ? ` и ещё ${zone.responsibles.length - 4}`
                                  : "")
                              : "Не назначены"}
                          </span>
                          <span className="text-slate-300">•</span>
                          {zone.freePoolCount > 0 ? (
                            <span className="text-amber-600 font-semibold">
                              Свободный пул: есть ({zone.freePoolCount} устр.)
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">
                              Свободный пул: нет
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Clean status indicators without heavy containers */}
                      <div className="flex flex-wrap items-center gap-3">
                        {zone.overdue > 0 && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            {zone.overdue} просрочено
                          </span>
                        )}
                        {zone.today > 0 && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            {zone.today} сегодня
                          </span>
                        )}
                        {zone.inProgress > 0 && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            {zone.inProgress} в работе
                          </span>
                        )}
                        {zone.rework > 0 && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-fuchsia-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500" />
                            {zone.rework} на доработке
                          </span>
                        )}
                        {zone.future > 0 && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                            {zone.future} позже
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {isZoneOpen && (
                    <div className="p-4 sm:p-6 space-y-4">
                      {zone.places.map((place) => {
                        const isPlaceOpen = expandedPlaces.has(place.key);
                        const hasVisibleDevices = place.devices.length > 0;

                        return (
                          <div
                            key={place.key}
                            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                hasVisibleDevices && togglePlace(place.key)
                              }
                              className={cn(
                                "w-full px-4 py-3.5 text-left transition-colors",
                                hasVisibleDevices
                                  ? "bg-slate-50/60 hover:bg-slate-50 cursor-pointer"
                                  : "bg-slate-50/30",
                              )}
                            >
                              <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                                <div className="flex items-center gap-2.5">
                                  <ChevronRight
                                    className={cn(
                                      "h-3.5 w-3.5 text-slate-400 transition-transform",
                                      isPlaceOpen &&
                                        hasVisibleDevices &&
                                        "rotate-90",
                                      !hasVisibleDevices && "opacity-30",
                                    )}
                                  />
                                  <div>
                                    <div className="text-sm sm:text-base font-bold text-slate-900">
                                      {place.name}
                                    </div>
                                    <div className="text-xs text-slate-400 font-medium">
                                      {place.zone}
                                    </div>
                                  </div>
                                </div>

                                {/* Clean place indicators without bulky badge containers */}
                                <div className="flex flex-wrap items-center gap-3">
                                  {place.isAvailableToAll && (
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                                      <Users className="w-3.5 h-3.5" />
                                      Доступна всем
                                    </span>
                                  )}
                                  {place.overdue > 0 && (
                                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                      {place.overdue} просрочено
                                    </span>
                                  )}
                                  {place.today > 0 && (
                                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                      {place.today} сегодня
                                    </span>
                                  )}
                                  {place.inProgress > 0 && (
                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600">
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                      {place.inProgress} в работе
                                    </span>
                                  )}
                                  {place.rework > 0 && (
                                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-fuchsia-600">
                                      <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500" />
                                      {place.rework} на доработке
                                    </span>
                                  )}
                                  {place.future > 0 && (
                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                      {place.future} позже
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>

                            {/* Place Assignee Bar */}
                            <div className="border-t border-slate-100 bg-white px-4 py-3">
                              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                                <div>
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Ответственный за место
                                  </div>
                                  <div className="mt-0.5 text-xs text-slate-400 font-medium">
                                    Назначение применяется ко всему оборудованию места
                                  </div>
                                </div>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5">
                                  {place.workstationId && (
                                    <div
                                      className="flex items-center gap-2"
                                      title="Если включено, ответственный остаётся за местом, но другие сотрудники также могут брать задачи чистки в работу"
                                    >
                                      <Switch
                                        id={`available-to-all-${place.key}`}
                                        checked={place.isAvailableToAll}
                                        onCheckedChange={(checked) =>
                                          handleToggleAvailableToAll(
                                            place.workstationId,
                                            checked,
                                          )
                                        }
                                      />
                                      <Label
                                        htmlFor={`available-to-all-${place.key}`}
                                        className="text-xs font-medium cursor-pointer select-none text-slate-700 whitespace-nowrap"
                                      >
                                        Доступна всем
                                      </Label>
                                    </div>
                                  )}
                                  <div className="w-full sm:w-60">
                                    <Select
                                      value={place.assignedUserId || "unassigned"}
                                      onValueChange={(value) =>
                                        handleAssignPlace(
                                          place.workstationId,
                                          value,
                                        )
                                      }
                                    >
                                      <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-slate-50 text-xs font-medium text-slate-800">
                                        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2 [&>span]:w-full [&>span]:block">
                                          <UserPlus className="h-4 w-4 text-slate-400 shrink-0" />
                                          <SelectValue placeholder="Назначить" />
                                        </div>
                                      </SelectTrigger>
                                      <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-64">
                                        <SelectItem value="unassigned" className="text-xs">
                                          Свободный пул
                                        </SelectItem>
                                        {assignableEmployees.map((employee) => (
                                          <SelectItem
                                            key={employee.id}
                                            value={employee.id}
                                            className="text-xs"
                                          >
                                            <div className="flex min-w-0 w-full items-center justify-between gap-3">
                                              <span className="truncate">
                                                {employee.full_name}
                                              </span>
                                              {employee.role ? (
                                                <span
                                                  className={cn(
                                                    "ml-auto shrink-0 text-[11px]",
                                                    getEmployeeRoleTextClass(
                                                      employee,
                                                    ),
                                                  )}
                                                >
                                                  {employee.role}
                                                </span>
                                              ) : null}
                                            </div>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Devices List with Equipment Indicator (MaintenanceSegmentedBar) */}
                            {isPlaceOpen && hasVisibleDevices && (
                              <div className="border-t border-slate-100 bg-slate-50/50 p-3 sm:p-4 space-y-2.5">
                                {place.devices.map((device) => {
                                  const assignmentMeta =
                                    getDeviceAssignmentMeta(device, place);
                                  const deviceProgress = getMaintenanceProgress({
                                    maintenance_enabled:
                                      device.maintenanceEnabled !== false,
                                    cleaning_interval_days:
                                      device.cleaningIntervalDays,
                                    last_cleaned_at: device.lastCleanedAt,
                                    due_date: device.nextDueDate,
                                  });

                                  const reworkTask = device.activeTasks.find(
                                    (t) =>
                                      t.status === "REWORK" ||
                                      (t.status === "IN_PROGRESS" &&
                                        t.verification_status === "REJECTED"),
                                  );
                                  const inProgressTask = device.activeTasks.find(
                                    (t) =>
                                      t.status === "IN_PROGRESS" &&
                                      t.verification_status !== "REJECTED",
                                  );

                                  return (
                                    <div
                                      key={device.key}
                                      className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition-shadow"
                                    >
                                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                        {/* Device Info & Status Bar */}
                                        <div className="min-w-0 flex-1 space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                              <h4 className="text-sm font-bold text-slate-900 leading-tight">
                                                {device.equipmentName}
                                              </h4>
                                              <span className="text-xs text-slate-400 font-medium">
                                                {device.equipmentTypeName}
                                              </span>
                                              {assignmentMeta.badgeLabel && (
                                                <span
                                                  className={cn(
                                                    "text-[11px] font-medium",
                                                    assignmentMeta.badgeClass,
                                                  )}
                                                >
                                                  {assignmentMeta.badgeLabel}
                                                </span>
                                              )}
                                              {device.isAvailableToAll && (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                                                  <Users className="w-3 h-3" />
                                                  Доступно всем
                                                </span>
                                              )}
                                            </div>

                                            {/* Maintenance Segmented Bar from Equipment module */}
                                            <div className="w-full max-w-md pt-0.5">
                                              <MaintenanceSegmentedBar
                                                progress={deviceProgress}
                                              />
                                            </div>

                                            {/* Task notifications if rework or in progress */}
                                            {reworkTask && (
                                              <div className="text-xs font-semibold text-fuchsia-700 bg-fuchsia-50/70 border border-fuchsia-200/60 px-2.5 py-1 rounded-lg mt-1">
                                                На доработке:{" "}
                                                {reworkTask.rejection_reason ||
                                                  "Центр проверок вернул задачу"}
                                              </div>
                                            )}
                                            {inProgressTask && (
                                              <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600 mt-0.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                                В работе у{" "}
                                                {inProgressTask.assigned_to_name ||
                                                  "сотрудника"}
                                              </div>
                                            )}

                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 font-medium pt-0.5">
                                              <span>
                                                Посл. чистка:{" "}
                                                {device.lastCleanedAt
                                                  ? new Date(
                                                      device.lastCleanedAt,
                                                    ).toLocaleDateString("ru-RU")
                                                  : "—"}
                                              </span>
                                              {device.nextDueDate && (
                                                <span>
                                                  • План:{" "}
                                                  {new Date(
                                                    device.nextDueDate,
                                                  ).toLocaleDateString("ru-RU")}
                                                </span>
                                              )}
                                            </div>
                                        </div>

                                        {/* Right side: Assignee Control & Quick Actions */}
                                        <div className="flex flex-wrap items-center gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                                          <div
                                            className="flex items-center gap-2"
                                            title="Если включено, ответственный остаётся за устройством, но другие сотрудники также могут брать задачу в работу"
                                          >
                                            <Switch
                                              id={`device-available-to-all-${device.key}`}
                                              checked={device.isAvailableToAll}
                                              onCheckedChange={(checked) =>
                                                handleToggleDeviceAvailableToAll(
                                                  device.equipmentId,
                                                  checked,
                                                )
                                              }
                                            />
                                            <Label
                                              htmlFor={`device-available-to-all-${device.key}`}
                                              className="text-xs font-medium cursor-pointer select-none text-slate-700 whitespace-nowrap"
                                            >
                                              Доступно всем
                                            </Label>
                                          </div>

                                          <div className="w-48 sm:w-56">
                                            <Select
                                              value={
                                                assignmentMeta.selectValue
                                              }
                                              onValueChange={(value) =>
                                                handleAssignEquipment(
                                                  device.equipmentId,
                                                  value,
                                                )
                                              }
                                            >
                                              <SelectTrigger className="h-9 w-full rounded-xl border-slate-200 bg-slate-50 hover:bg-slate-100/70 text-xs font-medium text-slate-800">
                                                <div className="flex items-center gap-2 min-w-0 flex-1 mr-2 [&>span]:w-full [&>span]:block">
                                                  <UserPlus className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                  <SelectValue placeholder="Назначить" />
                                                </div>
                                              </SelectTrigger>
                                              <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-64">
                                                <SelectItem
                                                  value="free_pool"
                                                  className="text-xs"
                                                >
                                                  Свободный пул
                                                </SelectItem>
                                                {assignableEmployees.map(
                                                  (employee) => (
                                                    <SelectItem
                                                      key={employee.id}
                                                      value={employee.id}
                                                      className="text-xs"
                                                    >
                                                      <div className="flex min-w-0 w-full items-center justify-between gap-3">
                                                        <span className="truncate">
                                                          {employee.full_name}
                                                        </span>
                                                        {employee.role ? (
                                                          <span
                                                            className={cn(
                                                                "ml-auto shrink-0 text-[11px]",
                                                              getEmployeeRoleTextClass(
                                                                employee,
                                                              ),
                                                            )}
                                                          >
                                                            {employee.role}
                                                          </span>
                                                        ) : null}
                                                      </div>
                                                    </SelectItem>
                                                  ),
                                                )}
                                              </SelectContent>
                                            </Select>
                                          </div>

                                          {device.activeTasks.some(
                                            (t) => t.status === "IN_PROGRESS",
                                          ) && (
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              className="h-7 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg px-2 cursor-pointer"
                                              onClick={() => {
                                                const inProg =
                                                  device.activeTasks.find(
                                                    (t) =>
                                                      t.status ===
                                                      "IN_PROGRESS",
                                                  );
                                                if (inProg) {
                                                  handleResetTask(inProg.id);
                                                }
                                              }}
                                            >
                                              Вернуть из «В работе»
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Mobile sticky back button */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/80 p-4 backdrop-blur-xl md:hidden pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-400 gap-2">
            <Button
              asChild
              variant="outline"
              className="flex-1 h-11 rounded-xl border-slate-200 text-slate-700 bg-white font-medium text-sm"
            >
              <Link href={`/clubs/${clubId}/equipment`}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Назад
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
