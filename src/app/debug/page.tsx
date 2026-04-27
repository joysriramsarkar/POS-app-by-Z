"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function CameraDebugPage() {
  const [testOutput, setTestOutput] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const appendLog = (message: string) => {
    console.log(message);
    setTestOutput((prev) => [...prev, message]);
  };

  const handleTestCameraAccess = async () => {
    setTestOutput([]);
    setIsRunning(true);

    try {
      appendLog("====== CAMERA DEBUG TEST ======");
      appendLog("");

      // Test 1: Check if getUserMedia is supported
      appendLog("1️⃣  Testing getUserMedia support...");
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        appendLog("❌ getUserMedia is NOT supported");
        setIsRunning(false);
        return;
      }
      appendLog("✅ getUserMedia is supported");

      // Test 2: List available devices
      appendLog("");
      appendLog("2️⃣  Listing available devices...");
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(
          (device) => device.kind === "videoinput",
        );

        if (videoDevices.length === 0) {
          appendLog("❌ No video devices found");
        } else {
          appendLog(`✅ Found ${videoDevices.length} video device(s):`);
          videoDevices.forEach((device, index) => {
            appendLog(
              `   ${index + 1}. ${device.label || `Camera ${index + 1}`}`,
            );
          });
        }
      } catch (error) {
        appendLog(
          `❌ Error enumerating devices: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Test 3: Request back camera
      appendLog("");
      appendLog("3️⃣  Testing back (environment) camera...");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        appendLog("✅ Back camera access granted");
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const settings = videoTrack.getSettings();
          appendLog(`   Resolution: ${settings.width}x${settings.height}`);
          appendLog(`   FacingMode: ${settings.facingMode}`);
        }

        stream.getTracks().forEach((track) => track.stop());
      } catch (error) {
        appendLog(
          `❌ Back camera failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Test 4: Request front camera
      appendLog("");
      appendLog("4️⃣  Testing front (user) camera...");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
          },
        });

        appendLog("✅ Front camera access granted");
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const settings = videoTrack.getSettings();
          appendLog(`   Resolution: ${settings.width}x${settings.height}`);
        }

        stream.getTracks().forEach((track) => track.stop());
      } catch (error) {
        appendLog(
          `❌ Front camera failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Test 5: Raw video element test
      appendLog("");
      appendLog("5️⃣  Testing raw video element...");
      try {
        const video = document.createElement("video");
        video.id = "debug-video-test";
        video.style.width = "100%";
        video.style.height = "300px";
        video.style.backgroundColor = "#000";
        video.style.marginTop = "20px";
        video.autoplay = true;
        video.playsInline = true;

        document.body.appendChild(video);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });

        video.srcObject = stream;
        appendLog("✅ Video element playing (should see camera feed below)");

        // Stop after 5 seconds
        setTimeout(() => {
          stream.getTracks().forEach((track) => track.stop());
          video.remove();
          appendLog("✅ Test video stopped");
        }, 5000);
      } catch (error) {
        appendLog(
          `❌ Raw video test failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      appendLog("");
      appendLog("====== TEST COMPLETE ======");
    } finally {
      setIsRunning(false);
    }
  };

  const handleTestHtml5Qrcode = async () => {
    setTestOutput([]);
    setIsRunning(true);

    try {
      appendLog("====== HTML5-QRCODE TEST ======");
      appendLog("");
      appendLog("1️⃣  Importing html5-qrcode...");

      try {
        const { Html5QrcodeScanner } = await import("html5-qrcode");
        appendLog("✅ html5-qrcode imported successfully");

        appendLog("");
        appendLog("2️⃣  Creating test container...");

        const testContainerId = "html5-qr-test-container";
        let testContainer = document.getElementById(testContainerId);

        if (!testContainer) {
          testContainer = document.createElement("div");
          testContainer.id = testContainerId;
          testContainer.style.width = "100%";
          testContainer.style.height = "400px";
          testContainer.style.backgroundColor = "#f0f0f0";
          testContainer.style.marginTop = "20px";
          testContainer.style.border = "2px solid #ccc";
          document.body.appendChild(testContainer);
          appendLog("✅ Container created");
        } else {
          testContainer.innerHTML = "";
          appendLog("✅ Container cleared and reused");
        }

        appendLog("");
        appendLog("3️⃣  Initializing Html5QrcodeScanner...");

        const scanner = new Html5QrcodeScanner(
          testContainerId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            rememberLastUsedCamera: true,
            showTorchButtonIfSupported: true,
          },
          false,
        );

        appendLog("✅ Scanner instance created");
        appendLog("");
        appendLog("4️⃣  Rendering scanner...");

        let hasScanned = false;

        scanner.render(
          (decodedText) => {
            appendLog(`✅ BARCODE DETECTED: ${decodedText}`);
            hasScanned = true;
          },
          (error) => {
            // Ignore scanning errors
          },
        );

        appendLog("✅ Scanner rendered (camera should appear below)");
        appendLog("");
        appendLog("Waiting 10 seconds for barcode scan...");

        // Stop scanner after 10 seconds
        setTimeout(() => {
          scanner.clear().catch(() => {});
          appendLog("✅ Scanner cleared");
          appendLog("");
          appendLog("====== TEST COMPLETE ======");
          if (!hasScanned) {
            appendLog("⚠️  No barcode was scanned during test");
          }
        }, 10000);
      } catch (error) {
        appendLog(
          `❌ Failed to import/use html5-qrcode: ${error instanceof Error ? error.message : String(error)}`,
        );
        appendLog(`Stack: ${error instanceof Error ? error.stack : undefined}`);
      }
    } finally {
      setIsRunning(false);
    }
  };

  const clearLogs = () => {
    setTestOutput([]);
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>📹 Camera Barcode Scanner Debug</CardTitle>
            <CardDescription>
              Run diagnostic tests to identify camera and barcode scanning
              issues
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={handleTestCameraAccess}
                disabled={isRunning}
                variant="default"
              >
                Test Camera Access
              </Button>
              <Button
                onClick={handleTestHtml5Qrcode}
                disabled={isRunning}
                variant="default"
              >
                Test Html5-QRCode
              </Button>
              <Button
                onClick={clearLogs}
                disabled={isRunning}
                variant="outline"
              >
                Clear Logs
              </Button>
            </div>

            {isRunning && (
              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription>
                  Running tests... Please wait
                </AlertDescription>
              </Alert>
            )}

            <div className="bg-black rounded-lg p-4 font-mono text-sm text-green-400 overflow-auto max-h-96 min-h-48">
              {testOutput.length === 0 ? (
                <div className="text-gray-500">Logs will appear here...</div>
              ) : (
                testOutput.map((log, index) => (
                  <div key={index} className="whitespace-pre-wrap break-words">
                    {log}
                  </div>
                ))
              )}
            </div>

            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertDescription>
                <strong>Instructions:</strong>
                <ul className="mt-2 ml-4 space-y-1 list-disc">
                  <li>
                    Click "Test Camera Access" to verify your device has camera
                    and permissions
                  </li>
                  <li>
                    Click "Test Html5-QRCode" to test the barcode scanner
                    library directly
                  </li>
                  <li>Watch the console output for detailed error messages</li>
                  <li>
                    Check browser DevTools (F12 → Console) for additional logs
                  </li>
                </ul>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <div id="test-output-area" className="mt-4" />
      </div>
    </div>
  );
}
