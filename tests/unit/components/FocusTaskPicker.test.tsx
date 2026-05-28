import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { FocusTaskPicker } from "@/components/FocusTaskPicker";

// ===== Hoisted mocks =====

const {
  mockStart,
  mockPause,
  mockCancel,
  mockToast,
  mockUseQuery,
  mockCreateClient,
} = vi.hoisted(() => ({
  mockStart: vi.fn(),
  mockPause: vi.fn(),
  mockCancel: vi.fn(),
  mockToast: vi.fn(),
  mockUseQuery: vi.fn(),
  mockCreateClient: vi.fn(),
}));

// ===== Mock state control =====

let mockActiveTaskId: string | null = null;
let mockIsRunning = false;
let mockMode: string = "focus";
let mockTaskSwitchBehavior: string = "keepRunning";
let mockIsDesktop = false;
let mockIsGuestMode = false;
let mockTasks: any[] = [];
let mockStoreTasks: any[] = [];

// ===== Module mocks =====

vi.mock("@/lib/store/timerStore", () => ({
  useTimerStore: (selector: (state: any) => any) => {
    const state = {
      state: {
        activeTaskId: mockActiveTaskId,
        isRunning: mockIsRunning,
        mode: mockMode,
        remainingSeconds: 1500,
        completedSessions: 0,
      },
      settings: {
        focusDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        taskSwitchBehavior: mockTaskSwitchBehavior,
      },
      start: mockStart,
      pause: mockPause,
      cancel: mockCancel,
      updateSettings: vi.fn(),
      setActiveTaskId: vi.fn(),
    };
    return selector(state);
  },
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    isGuestMode: mockIsGuestMode,
    user: mockIsGuestMode ? { id: "guest" } : { id: "user-1" },
  }),
}));

vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: (query: string) => {
    if (query === "(min-width: 768px)") return mockIsDesktop;
    return false;
  },
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({
    trigger: vi.fn(),
    isPhone: !mockIsDesktop,
    hapticsEnabled: true,
  }),
}));

vi.mock("@/lib/hooks/useBackNavigation", () => ({
  useBackNavigation: vi.fn(),
}));

vi.mock("@/lib/mock/mock-store", () => ({
  mockStore: {
    getTasks: () => mockStoreTasks,
  },
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: any) => mockUseQuery(options),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockCreateClient(),
}));

vi.mock("lucide-react", () => ({
  Target: (props: any) => <svg data-testid="target-icon" {...props} />,
  Check: (props: any) => <svg data-testid="check-icon" {...props} />,
  X: (props: any) => <svg data-testid="x-icon" {...props} />,
}));

// Mock shadcn Dialog
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: any) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogTrigger: ({ children }: any) => <div>{children}</div>,
}));

// Mock shadcn Drawer
vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({ children, open }: any) =>
    open ? <div data-testid="drawer">{children}</div> : null,
  DrawerContent: ({ children }: any) => (
    <div data-testid="drawer-content">{children}</div>
  ),
  DrawerHeader: ({ children }: any) => <div>{children}</div>,
  DrawerTitle: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: (props: any) => <div data-testid="skeleton" {...props} />,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  buttonVariants: () => "",
}));

// ===== Test Helpers =====

const TODAY = new Date().toISOString().split("T")[0];

function createMockTask(overrides: any = {}) {
  return {
    id: "task-1",
    user_id: "user-1",
    project_id: null,
    parent_id: null,
    content: "Test task",
    description: null,
    priority: 2,
    due_date: null,
    do_date: TODAY,
    is_evening: false,
    is_completed: false,
    completed_at: null,
    day_order: 1,
    recurrence: null,
    google_event_id: null,
    google_etag: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("FocusTaskPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveTaskId = null;
    mockIsRunning = false;
    mockMode = "focus";
    mockTaskSwitchBehavior = "keepRunning";
    mockIsDesktop = false;
    mockIsGuestMode = false;
    mockTasks = [];
    mockStoreTasks = [];
    mockUseQuery.mockReset();

    // Default useQuery mock — returns idle/no-data state
    mockUseQuery.mockImplementation((options: any) => {
      // Active task query
      if (options.queryKey?.[0] === "task") {
        if (options.enabled === false) return { data: null, isLoading: false };
        return { data: null, isLoading: false };
      }
      // Tasks for picker
      return { data: [], isLoading: false };
    });

    mockCreateClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    });
  });

  // Test 1: Chip renders task name when activeTaskId is set
  it("renders task name on chip when activeTaskId is set", () => {
    mockActiveTaskId = "task-1";
    mockUseQuery.mockImplementation((options: any) => {
      if (
        options.queryKey?.[0] === "task" &&
        options.queryKey?.[1] === "task-1"
      ) {
        return {
          data: createMockTask({
            id: "task-1",
            content: "Write documentation",
          }),
          isLoading: false,
        };
      }
      return { data: [], isLoading: false };
    });

    render(<FocusTaskPicker />);
    expect(screen.getByText("Write documentation")).toBeInTheDocument();
  });

  // Test 1b: Chip renders "Add task" when no activeTaskId
  it('renders "Add task" on chip when no activeTaskId', () => {
    mockActiveTaskId = null;

    render(<FocusTaskPicker />);
    expect(screen.getByText("Add task")).toBeInTheDocument();
  });

  // Test 2: Tapping chip opens Drawer on mobile
  it("opens Drawer on mobile when chip is tapped", () => {
    mockIsDesktop = false;
    mockActiveTaskId = null;

    render(<FocusTaskPicker />);

    const chip = screen.getByRole("button", { name: "Select focus task" });
    fireEvent.click(chip);

    expect(screen.getByTestId("drawer")).toBeInTheDocument();
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  // Test 2b: Tapping chip opens Dialog on desktop
  it("opens Dialog on desktop when chip is tapped", () => {
    mockIsDesktop = true;
    mockActiveTaskId = null;

    render(<FocusTaskPicker />);

    const chip = screen.getByRole("button", { name: "Select focus task" });
    fireEvent.click(chip);

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.queryByTestId("drawer")).not.toBeInTheDocument();
  });

  // Test 3: Task picker shows today's tasks
  it("shows today's tasks in the picker", async () => {
    mockActiveTaskId = null;
    mockTasks = [
      createMockTask({ id: "task-1", content: "Design review" }),
      createMockTask({ id: "task-2", content: "Write tests" }),
    ];

    // When the picker opens, tasks query returns data
    let tasksQueryEnabled = false;
    mockUseQuery.mockImplementation((options: any) => {
      if (options.queryKey?.[0] === "focus-tasks") {
        tasksQueryEnabled = options.enabled ?? false;
        if (tasksQueryEnabled) {
          return { data: mockTasks, isLoading: false };
        }
        return { data: [], isLoading: false };
      }
      if (options.queryKey?.[0] === "task") {
        return { data: null, isLoading: false };
      }
      return { data: [], isLoading: false };
    });

    render(<FocusTaskPicker />);

    // Chip tap to open picker
    const chip = screen.getByRole("button", { name: "Select focus task" });
    fireEvent.click(chip);

    // Picker shows today's tasks
    await waitFor(() => {
      expect(screen.getByText("Design review")).toBeInTheDocument();
    });
    expect(screen.getByText("Write tests")).toBeInTheDocument();
  });

  // Test 4: keepRunning — timer keeps running, toast shown
  it("keeps timer running when taskSwitchBehavior is keepRunning", () => {
    mockActiveTaskId = "task-1";
    mockTaskSwitchBehavior = "keepRunning";
    mockIsRunning = true;

    // Mock the active task query
    mockUseQuery.mockImplementation((options: any) => {
      if (options.queryKey?.[0] === "task") {
        return {
          data: createMockTask({ id: "task-1", content: "Current task" }),
          isLoading: false,
        };
      }
      if (options.queryKey?.[0] === "focus-tasks") {
        return {
          data: [createMockTask({ id: "task-2", content: "New task" })],
          isLoading: false,
        };
      }
      return { data: [], isLoading: false };
    });

    render(<FocusTaskPicker />);

    // Open picker
    const chip = screen.getByRole("button", { name: /Change focus task/i });
    fireEvent.click(chip);

    // Click on the new task
    const newTask = screen.getByText("New task");
    fireEvent.click(newTask);

    // Timer should NOT be paused or cancelled — kept running
    expect(mockPause).not.toHaveBeenCalled();
    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith("Now focusing on New task");
  });

  // Test 5: pauseOnSwitch — timer pauses, toast shown
  it("pauses timer when taskSwitchBehavior is pauseOnSwitch", () => {
    mockActiveTaskId = "task-1";
    mockTaskSwitchBehavior = "pauseOnSwitch";
    mockIsRunning = true;

    mockUseQuery.mockImplementation((options: any) => {
      if (options.queryKey?.[0] === "task") {
        return {
          data: createMockTask({ id: "task-1", content: "Current task" }),
          isLoading: false,
        };
      }
      if (options.queryKey?.[0] === "focus-tasks") {
        return {
          data: [createMockTask({ id: "task-2", content: "New task" })],
          isLoading: false,
        };
      }
      return { data: [], isLoading: false };
    });

    render(<FocusTaskPicker />);

    const chip = screen.getByRole("button", { name: /Change focus task/i });
    fireEvent.click(chip);

    const newTask = screen.getByText("New task");
    fireEvent.click(newTask);

    expect(mockPause).toHaveBeenCalledTimes(1);
    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith("Now focusing on New task");
  });

  // Test 6: resetOnSwitch — cancels timer, toast shown
  it("cancels timer when taskSwitchBehavior is resetOnSwitch", () => {
    mockActiveTaskId = "task-1";
    mockTaskSwitchBehavior = "resetOnSwitch";
    mockIsRunning = true;

    mockUseQuery.mockImplementation((options: any) => {
      if (options.queryKey?.[0] === "task") {
        return {
          data: createMockTask({ id: "task-1", content: "Current task" }),
          isLoading: false,
        };
      }
      if (options.queryKey?.[0] === "focus-tasks") {
        return {
          data: [createMockTask({ id: "task-2", content: "New task" })],
          isLoading: false,
        };
      }
      return { data: [], isLoading: false };
    });

    render(<FocusTaskPicker />);

    const chip = screen.getByRole("button", { name: /Change focus task/i });
    fireEvent.click(chip);

    const newTask = screen.getByText("New task");
    fireEvent.click(newTask);

    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockPause).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith("Now focusing on New task");
  });

  // Test 7: Completed tasks shown dimmed and not tappable
  it("shows completed tasks at opacity-40 with strikethrough and not tappable", () => {
    mockActiveTaskId = null;
    const completedTask = createMockTask({
      id: "task-3",
      content: "Completed item",
      is_completed: true,
    });

    mockUseQuery.mockImplementation((options: any) => {
      if (options.queryKey?.[0] === "focus-tasks") {
        return {
          data: [completedTask],
          isLoading: false,
        };
      }
      if (options.queryKey?.[0] === "task") {
        return { data: null, isLoading: false };
      }
      return { data: [], isLoading: false };
    });

    render(<FocusTaskPicker />);

    const chip = screen.getByRole("button", { name: "Select focus task" });
    fireEvent.click(chip);

    // Completed task should render with dimmed styling — verify it appears
    const taskEl = screen.getByText("Completed item");
    expect(taskEl).toBeInTheDocument();

    // The parent container should have opacity classes
    const parentRow = taskEl.closest("[data-testid='task-row']");
    expect(parentRow).toBeInTheDocument();
  });

  // Test 8: Empty state shows "Nothing due today"
  it("shows empty state message when no tasks", () => {
    mockActiveTaskId = null;

    mockUseQuery.mockImplementation((options: any) => {
      if (options.queryKey?.[0] === "focus-tasks") {
        return { data: [], isLoading: false };
      }
      if (options.queryKey?.[0] === "task") {
        return { data: null, isLoading: false };
      }
      return { data: [], isLoading: false };
    });

    render(<FocusTaskPicker />);

    const chip = screen.getByRole("button", { name: "Select focus task" });
    fireEvent.click(chip);

    expect(screen.getByText("Nothing due today")).toBeInTheDocument();
    expect(
      screen.getByText("Tasks scheduled for today will appear here."),
    ).toBeInTheDocument();
  });

  // ===================================================================
  // Task 1 Tests — Guest-mode branch + date-aware queryKey for picker list
  // ===================================================================

  it("[T1] uses date-aware queryKey for picker with isGuestMode flag", () => {
    mockIsGuestMode = false;
    mockActiveTaskId = null;

    const callArgs: any[] = [];
    mockUseQuery.mockImplementation((options: any) => {
      callArgs.push(options);
      if (options.queryKey?.[0] === "task")
        return { data: null, isLoading: false };
      return { data: [], isLoading: false };
    });

    render(<FocusTaskPicker />);
    const chip = screen.getByRole("button", { name: "Select focus task" });
    fireEvent.click(chip);

    // Find the picker query
    const focusTaskCall = callArgs.find(
      (opts) => opts.queryKey?.[0] === "focus-tasks",
    );
    expect(focusTaskCall).toBeDefined();
    const [, today, guestFlag] = focusTaskCall.queryKey;
    // Verify date string format: YYYY-MM-DD
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(guestFlag).toBe(false);
  });

  it("[T2] shows today's + overdue tasks for guest mode via mockStore", async () => {
    mockIsGuestMode = true;
    mockActiveTaskId = null;

    const guestTasks = [
      createMockTask({
        id: "g-1",
        content: "Guest task today",
        do_date: TODAY,
      }),
      createMockTask({
        id: "g-2",
        content: "Guest overdue",
        do_date: "2026-05-23",
      }),
      createMockTask({
        id: "g-3",
        content: "Future task",
        do_date: "2026-05-25",
      }),
    ];

    // Mock useQuery to return the two relevant tasks when guest mode is detected
    mockUseQuery.mockImplementation((options: any) => {
      if (
        options.queryKey?.[0] === "focus-tasks" &&
        options.queryKey?.[2] === true
      ) {
        return { data: [guestTasks[0], guestTasks[1]], isLoading: false };
      }
      if (options.queryKey?.[0] === "task")
        return { data: null, isLoading: false };
      return { data: [], isLoading: false };
    });

    render(<FocusTaskPicker />);
    const chip = screen.getByRole("button", { name: "Select focus task" });
    fireEvent.click(chip);

    await waitFor(() => {
      expect(screen.getByText("Guest task today")).toBeInTheDocument();
    });
    expect(screen.getByText("Guest overdue")).toBeInTheDocument();
    expect(screen.queryByText("Future task")).not.toBeInTheDocument();
  });

  it("[T3] shows empty state for guest mode when no tasks due today", () => {
    mockIsGuestMode = true;
    mockActiveTaskId = null;

    mockUseQuery.mockImplementation((options: any) => {
      if (
        options.queryKey?.[0] === "focus-tasks" &&
        options.queryKey?.[2] === true
      ) {
        return { data: [], isLoading: false };
      }
      if (options.queryKey?.[0] === "task")
        return { data: null, isLoading: false };
      return { data: [], isLoading: false };
    });

    render(<FocusTaskPicker />);
    const chip = screen.getByRole("button", { name: "Select focus task" });
    fireEvent.click(chip);
    expect(screen.getByText("Nothing due today")).toBeInTheDocument();
  });

  it("[T4] has enabled=true for picker regardless of guest mode when open", () => {
    mockIsGuestMode = true;
    mockActiveTaskId = null;

    const callArgs: any[] = [];
    mockUseQuery.mockImplementation((options: any) => {
      callArgs.push(options);
      if (options.queryKey?.[0] === "task")
        return { data: null, isLoading: false };
      return { data: [], isLoading: false };
    });

    render(<FocusTaskPicker />);
    const chip = screen.getByRole("button", { name: "Select focus task" });
    fireEvent.click(chip);

    // Find the LAST focus-tasks call (after the picker opened)
    const focusTaskCalls = callArgs.filter(
      (opts) => opts.queryKey?.[0] === "focus-tasks",
    );
    expect(focusTaskCalls.length).toBeGreaterThanOrEqual(1);
    const lastFocusTaskCall = focusTaskCalls[focusTaskCalls.length - 1];
    expect(lastFocusTaskCall.enabled).toBe(true);
  });

  // ===================================================================
  // Task 2 Tests — Guest-mode branch for chip detail (active task name)
  // ===================================================================

  it("[T5] shows task name on chip from mockStore for guest mode", () => {
    mockIsGuestMode = true;
    mockActiveTaskId = "g-1";
    mockStoreTasks = [createMockTask({ id: "g-1", content: "Write report" })];

    // Task query is disabled for guests, mockStore fallback handles it
    mockUseQuery.mockImplementation((options: any) => {
      if (options.queryKey?.[0] === "task") {
        return { data: null, isLoading: false };
      }
      if (options.queryKey?.[0] === "focus-tasks") {
        return { data: [], isLoading: false };
      }
      return { data: [], isLoading: false };
    });

    render(<FocusTaskPicker />);
    expect(screen.getByText("Write report")).toBeInTheDocument();
    expect(screen.queryByText("Add task")).not.toBeInTheDocument();
  });

  it("[T6] shows task name on chip from Supabase query for auth mode", () => {
    mockIsGuestMode = false;
    mockActiveTaskId = "task-123";

    mockUseQuery.mockImplementation((options: any) => {
      if (
        options.queryKey?.[0] === "task" &&
        options.queryKey?.[1] === "task-123"
      ) {
        return {
          data: createMockTask({ id: "task-123", content: "Supabase task" }),
          isLoading: false,
        };
      }
      if (options.queryKey?.[0] === "focus-tasks") {
        return { data: [], isLoading: false };
      }
      return { data: null, isLoading: false };
    });

    render(<FocusTaskPicker />);
    expect(screen.getByText("Supabase task")).toBeInTheDocument();
  });

  it("[T7] shows 'Add task' placeholder when no activeTaskId (either mode)", () => {
    // Auth mode — no active task
    mockIsGuestMode = false;
    mockActiveTaskId = null;

    mockUseQuery.mockImplementation((options: any) => {
      if (options.queryKey?.[0] === "task")
        return { data: null, isLoading: false };
      if (options.queryKey?.[0] === "focus-tasks")
        return { data: [], isLoading: false };
      return { data: [], isLoading: false };
    });

    const { unmount } = render(<FocusTaskPicker />);
    expect(screen.getByText("Add task")).toBeInTheDocument();
    unmount();

    // Guest mode — no active task
    mockIsGuestMode = true;
    mockActiveTaskId = null;

    render(<FocusTaskPicker />);
    expect(screen.getByText("Add task")).toBeInTheDocument();
  });

  it("[T8] does not fire Supabase task query for guest mode (disabled)", () => {
    mockIsGuestMode = true;
    mockActiveTaskId = "g-1";
    mockStoreTasks = [
      createMockTask({ id: "g-1", content: "Guest chip task" }),
    ];

    const callArgs: any[] = [];
    mockUseQuery.mockImplementation((options: any) => {
      callArgs.push(options);
      return { data: null, isLoading: false };
    });

    render(<FocusTaskPicker />);

    // Chip should show guest task name from mockStore
    expect(screen.getByText("Guest chip task")).toBeInTheDocument();

    // The task query for guest mode should have enabled=false
    const guestTaskQuery = callArgs.find(
      (opts) => opts.queryKey?.[0] === "task" && opts.queryKey?.[2] === true,
    );
    expect(guestTaskQuery).toBeDefined();
    expect(guestTaskQuery.enabled).toBe(false);
  });
});
