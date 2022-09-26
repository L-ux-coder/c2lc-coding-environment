#include <ArduinoBLE.h>
#include <Servo.h>

BLEService robotService("19B10000-E8F2-537E-4F6C-D104768A1214");

BLEByteCharacteristic commandCharacteristic("19B10001-E8F2-537E-4F6C-D104768A1214", BLERead | BLEWrite | BLENotify);
BLEByteCharacteristic notificationCharacteristic("19B10002-E8F2-537E-4F6C-D104768A1214", BLERead | BLEWrite | BLENotify);

Servo servo1;
Servo servo2;

void setup() {
    pinMode(9,OUTPUT);
    pinMode(10,OUTPUT);
    digitalWrite(9,LOW);
    digitalWrite(10,LOW);
    servo1.attach(9);
    servo1.write(89);
    servo2.attach(10);
    servo2.write(86);

    Serial.begin(9600);
    while (!Serial);

    if (!BLE.begin()) {
        Serial.println("Starting BLE failed!");
        while (1);
    }

    // Set advertised local name and service UUID:
    BLE.setLocalName("Open Robot");
    BLE.setAdvertisedService(robotService);

    // Add the characteristics to the service
    robotService.addCharacteristic(commandCharacteristic);
    robotService.addCharacteristic(notificationCharacteristic);

    // Add the service
    BLE.addService(robotService);

    // Set the initial value for the characeristics
    commandCharacteristic.writeValue(0);
    notificationCharacteristic.writeValue(0);

    // Start advertising
    BLE.advertise();

    Serial.println("Robot ready");
}

void loop() {
    BLEDevice central = BLE.central();

    if (central) {
        Serial.print("Connected to central: ");
        Serial.println(central.address());

        while (central.connected()) {
            int code_speed = 500;

            if (commandCharacteristic.written()) {
                // TODO: The line below was where I was seeing 0x00 is read as 128
                Serial.println(commandCharacteristic.value());
                if (commandCharacteristic.value() == 1) {
                    Serial.println("Forward");
                    notificationCharacteristic.writeValue((byte)0x01);
                    servo1.write(-180);
                    servo2.write(180);
                    delay(code_speed);
                    servo1.write(89);
                    servo2.write(86);
                    notificationCharacteristic.writeValue((byte)0x02);
                } else if (commandCharacteristic.value() == 2) {
                    Serial.println("Left");
                    notificationCharacteristic.writeValue((byte)0x01);
                    servo1.write(180);
                    servo2.write(180);
                    delay(code_speed);
                    servo1.write(89);
                    servo2.write(86);
                    notificationCharacteristic.writeValue((byte)0x02);
                } else if (commandCharacteristic.value() == 3) {
                    Serial.println("Right");
                    notificationCharacteristic.writeValue((byte)0x01);
                    servo1.write(-180);
                    servo2.write(-180);
                    delay(code_speed);
                    servo1.write(89);
                    servo2.write(86);
                    notificationCharacteristic.writeValue((byte)0x02);
                } else if (commandCharacteristic.value() == 4) {
                    Serial.println("backward");
                    notificationCharacteristic.writeValue((byte)0x01);
                    servo1.write(180);
                    servo2.write(-180);
                    delay(code_speed);
                    servo1.write(89);
                    servo2.write(86);
                    notificationCharacteristic.writeValue((byte)0x02);
                }
                else if (commandCharacteristic.value() == 5){
                  Serial.println("Right 90 degrees");
                  notificationCharacteristic.writeValue((byte)0x01);
                  servo1.write(-180);
                  servo2.write(-180);
                  delay(code_speed*2);
                  servo1.write(89);
                  servo2.write(86);
                  notificationCharacteristic.writeValue((byte)0x02);
                  }
                  else if (commandCharacteristic.value() == 6){
                  Serial.println("Left 90 degrees");
                  notificationCharacteristic.writeValue((byte)0x01);
                  servo1.write(180);
                  servo2.write(180);
                  delay(code_speed*2);
                  servo1.write(89);
                  servo2.write(86);
                  notificationCharacteristic.writeValue((byte)0x02);
                  }
            }
        }

        // Disconnected
        Serial.print(F("Disconnected from central: "));
        Serial.println(central.address());
    }
}
