"use client"

const CALIBRATION_URL = "https://dualshock-tools.github.io/"

export default function EmployeeCalibrationPage() {
    return (
        <div className="h-[calc(100dvh-56px)] w-full">
            <iframe
                title="DualShock Tools Calibration"
                src={CALIBRATION_URL}
                className="h-full w-full"
                allow="hid; usb; gamepad; fullscreen"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock"
                referrerPolicy="no-referrer"
            />
        </div>
    )
}
