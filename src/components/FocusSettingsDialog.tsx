"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Settings } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useTimer } from "@/components/TimerProvider";
import { useBackNavigation } from "@/lib/hooks/useBackNavigation";

import {
  useForm,
  FormProvider,
  useFormContext,
  useWatch,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FocusSettingsSchema } from "@/lib/schemas/settings";
import { TimerSettings } from "@/lib/types/timer";

// Extracted settings form component
function SettingsForm() {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<TimerSettings>();

  // useWatch is React Compiler-compatible (unlike watch() for rendering).
  // React Compiler memoizes components and skips re-renders when it cannot
  // detect state changes — watch("field") uses an internal pub/sub that the
  // compiler cannot track, causing toggles and sliders to appear stuck.
  const focusDuration = useWatch({ control, name: "focusDuration" });
  const shortBreak = useWatch({ control, name: "shortBreakDuration" });
  const longBreak = useWatch({ control, name: "longBreakDuration" });
  const sessions = useWatch({ control, name: "sessionsBeforeLongBreak" });
  const autoStartBreak = useWatch({ control, name: "autoStartBreak" });
  const autoStartFocus = useWatch({ control, name: "autoStartFocus" });

  return (
    <div className="space-y-6 py-4">
      {/* Focus Duration */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium" htmlFor="focus-duration-input">
            Focus Duration
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="focus-duration-input"
              type="number"
              {...register("focusDuration", { valueAsNumber: true })}
              className={cn(
                "w-16 h-8 text-sm bg-secondary/30 border-transparent hover:bg-secondary/50 text-center rounded-md",
                errors.focusDuration && "border-destructive ring-destructive",
              )}
              aria-invalid={!!errors.focusDuration}
              aria-describedby={
                errors.focusDuration ? "focus-duration-error" : undefined
              }
            />
            <span className="text-sm text-muted-foreground">min</span>
          </div>
        </div>
        <Slider
          value={[focusDuration]}
          onValueChange={([value]) =>
            setValue("focusDuration", value, { shouldValidate: true })
          }
          min={1}
          max={120}
          step={1}
          className="w-full"
        />
        {errors.focusDuration && (
          <p
            id="focus-duration-error"
            className="text-xs text-destructive font-medium"
          >
            {errors.focusDuration.message}
          </p>
        )}
      </div>

      {/* Short Break */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium" htmlFor="short-break-input">
            Short Break
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="short-break-input"
              type="number"
              {...register("shortBreakDuration", { valueAsNumber: true })}
              className={cn(
                "w-16 h-8 text-sm bg-secondary/30 border-transparent hover:bg-secondary/50 text-center rounded-md",
                errors.shortBreakDuration &&
                  "border-destructive ring-destructive",
              )}
              aria-invalid={!!errors.shortBreakDuration}
              aria-describedby={
                errors.shortBreakDuration ? "short-break-error" : undefined
              }
            />
            <span className="text-sm text-muted-foreground">min</span>
          </div>
        </div>
        <Slider
          value={[shortBreak]}
          onValueChange={([value]) =>
            setValue("shortBreakDuration", value, { shouldValidate: true })
          }
          min={1}
          max={30}
          step={1}
          className="w-full"
        />
        {errors.shortBreakDuration && (
          <p
            id="short-break-error"
            className="text-xs text-destructive font-medium"
          >
            {errors.shortBreakDuration.message}
          </p>
        )}
      </div>

      {/* Long Break */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium" htmlFor="long-break-input">
            Long Break
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="long-break-input"
              type="number"
              {...register("longBreakDuration", { valueAsNumber: true })}
              className={cn(
                "w-16 h-8 text-sm bg-secondary/30 border-transparent hover:bg-secondary/50 text-center rounded-md",
                errors.longBreakDuration &&
                  "border-destructive ring-destructive",
              )}
              aria-invalid={!!errors.longBreakDuration}
              aria-describedby={
                errors.longBreakDuration ? "long-break-error" : undefined
              }
            />
            <span className="text-sm text-muted-foreground">min</span>
          </div>
        </div>
        <Slider
          value={[longBreak]}
          onValueChange={([value]) =>
            setValue("longBreakDuration", value, { shouldValidate: true })
          }
          min={5}
          max={60}
          step={1}
          className="w-full"
        />
        {errors.longBreakDuration && (
          <p
            id="long-break-error"
            className="text-xs text-destructive font-medium"
          >
            {errors.longBreakDuration.message}
          </p>
        )}
      </div>

      {/* Sessions Before Long Break */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium" htmlFor="sessions-input">
            Sessions Until Long Break
          </Label>
          <Input
            id="sessions-input"
            type="number"
            {...register("sessionsBeforeLongBreak", { valueAsNumber: true })}
            className={cn(
              "w-16 h-8 text-sm bg-secondary/30 border-transparent hover:bg-secondary/50 text-center rounded-md",
              errors.sessionsBeforeLongBreak &&
                "border-destructive ring-destructive",
            )}
            aria-invalid={!!errors.sessionsBeforeLongBreak}
            aria-describedby={
              errors.sessionsBeforeLongBreak ? "sessions-error" : undefined
            }
          />
        </div>
        <Slider
          value={[sessions]}
          onValueChange={([value]) =>
            setValue("sessionsBeforeLongBreak", value, { shouldValidate: true })
          }
          min={2}
          max={10}
          step={1}
          className="w-full"
        />
        {errors.sessionsBeforeLongBreak && (
          <p
            id="sessions-error"
            className="text-xs text-destructive font-medium"
          >
            {errors.sessionsBeforeLongBreak.message}
          </p>
        )}
      </div>

      {/* Auto-start Settings */}
      <div className="space-y-4 pt-2 border-t">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label
              className="text-sm font-medium"
              htmlFor="auto-start-break-switch"
            >
              Auto-start Breaks
            </Label>
            <p className="text-xs text-muted-foreground">
              Automatically start break timer after focus session
            </p>
          </div>
          <Switch
            id="auto-start-break-switch"
            checked={autoStartBreak}
            onCheckedChange={(checked) =>
              setValue("autoStartBreak", checked, { shouldValidate: true })
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label
              className="text-sm font-medium"
              htmlFor="auto-start-focus-switch"
            >
              Auto-start Focus
            </Label>
            <p className="text-xs text-muted-foreground">
              Automatically start focus timer after break
            </p>
          </div>
          <Switch
            id="auto-start-focus-switch"
            checked={autoStartFocus}
            onCheckedChange={(checked) =>
              setValue("autoStartFocus", checked, { shouldValidate: true })
            }
          />
        </div>
      </div>
    </div>
  );
}

export function FocusSettingsDialog() {
  const { settings, updateSettings } = useTimer();
  const { trigger, isPhone } = useHaptic();
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const methods = useForm<TimerSettings>({
    resolver: zodResolver(FocusSettingsSchema),
    mode: "onChange",
    defaultValues: {
      focusDuration: settings.focusDuration,
      shortBreakDuration: settings.shortBreakDuration,
      longBreakDuration: settings.longBreakDuration,
      sessionsBeforeLongBreak: settings.sessionsBeforeLongBreak,
      autoStartBreak: settings.autoStartBreak,
      autoStartFocus: settings.autoStartFocus,
    },
  });

  const {
    handleSubmit,
    reset,
    watch,
    formState: { isValid },
  } = methods;

  // Stable ref for updateSettings — prevents useEffect resubscribing on every
  // timer tick (TimerProvider recreates the context object each second because
  // timer.state changes, causing updateSettings reference to appear new even
  // though the underlying Zustand action is stable).
  const updateSettingsRef = useRef(updateSettings);
  useEffect(() => {
    updateSettingsRef.current = updateSettings;
  }, [updateSettings]);

  // D-08: Direct reactive persistence - save settings instantly
  // This ensures changes are applied even if the dialog is open during a session
  useEffect(() => {
    // eslint-disable-next-line
    const subscription = watch((value) => {
      // Save on any form value change (setValue, native input, etc.)
      // RHF watch(callback) does not fire on initial subscription — no mount guard needed.
      // type === "change" was previously used as a guard but it is only set for native DOM
      // change events; setValue() (used by sliders/switches) fires with type: undefined,
      // causing slider/switch changes to never persist. safeParse provides the safety net.
      if (value) {
        const parsed = FocusSettingsSchema.safeParse(value);
        if (parsed.success) {
          updateSettingsRef.current(parsed.data);
        }
      }
    });
    return () => subscription.unsubscribe();
    // watch is a stable reference (RHF guarantee) — updateSettings via ref above
  }, [watch]);

  // Handle back navigation on mobile to close drawer instead of navigating away
  useBackNavigation(open && !isDesktop, () => setOpen(false));

  const onFormSubmit = () => {
    trigger("thud");
    // Settings already saved via watch() - just close
    setOpen(false);
  };

  const handleCancel = () => {
    trigger("tick");
    reset();
    setOpen(false);
  };

  const triggerButton = (
    <motion.button
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "text-muted-foreground hover:text-foreground hover:bg-accent active:scale-95 active:bg-accent/50 transition-all cursor-pointer",
      )}
      onTapStart={() => trigger("thud")}
      whileTap={isPhone ? { scale: 0.95 } : {}}
    >
      <Settings className="h-4 w-4 mr-2" />
      Adjust Settings
    </motion.button>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{triggerButton}</DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Timer Settings</DialogTitle>
            <DialogDescription>
              Customize your focus and break durations
              <span id="settings-desc" className="sr-only">
                Form to update timer durations and transitions
              </span>
            </DialogDescription>
          </DialogHeader>
          <FormProvider {...methods}>
            <form onSubmit={handleSubmit(onFormSubmit)}>
              <SettingsForm />
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!isValid}>
                  Save Changes
                </Button>
              </div>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen} repositionInputs={false}>
      <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
      <DrawerContent className="max-h-[92dvh] flex flex-col">
        <DrawerHeader className="text-left shrink-0">
          <DrawerTitle>Timer Settings</DrawerTitle>
          <DrawerDescription>
            Customize your focus and break durations
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 overflow-y-auto flex-1">
          <FormProvider {...methods}>
            <SettingsForm />
          </FormProvider>
        </div>
        <DrawerFooter className="pt-2 shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button onClick={handleSubmit(onFormSubmit)} disabled={!isValid}>
            Save Changes
          </Button>
          <DrawerClose asChild>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
