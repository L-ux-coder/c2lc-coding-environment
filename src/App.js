// @flow
import React from 'react';
import { FormattedMessage } from 'react-intl';
import { injectIntl } from 'react-intl';
import type {IntlShape} from 'react-intl';
import DisallowedActionsSerializer from './DisallowedActionsSerializer';
import AnnouncementBuilder from './AnnouncementBuilder';
import AudioManagerImpl from './AudioManagerImpl';
import CharacterAriaLive from './CharacterAriaLive';
import CharacterState from './CharacterState';
import CharacterStateSerializer from './CharacterStateSerializer';
import CharacterPositionController from './CharacterPositionController';
import CommandPaletteCommand from './CommandPaletteCommand';
import C2lcURLParams from './C2lcURLParams';
import DeviceConnectControl from './DeviceConnectControl';
import RobotConnectionErrorModal from './RobotConnectionErrorModal';
import ArduinoDriver from './ArduinoDriver';
import * as FeatureDetection from './FeatureDetection';
import FakeAudioManager from './FakeAudioManager';
import FocusTrapManager from './FocusTrapManager';
import IconButton from './IconButton';
import Interpreter from './Interpreter';
import PlayButton from './PlayButton';
import ProgramBlockEditor from './ProgramBlockEditor';
import RefreshButton from './RefreshButton';
import Scene from './Scene';
import SceneDimensions from './SceneDimensions';
import SoundOptionsModal from './SoundOptionsModal';
import StopButton from './StopButton';
import PenDownToggleSwitch from './PenDownToggleSwitch';
import ProgramSequence from './ProgramSequence';
import ProgramSpeedController from './ProgramSpeedController';
import ProgramSerializer from './ProgramSerializer';
import ActionsSimplificationModal from './ActionsSimplificationModal';
import type { ActionToggleRegister, AudioManager, DeviceConnectionStatus, DisplayedCommandName, RobotDriver, RunningState, ThemeName } from './types';
import type { WorldName } from './Worlds';
import { getWorldProperties } from './Worlds';
import WorldSelector from './WorldSelector';
import * as Utils from './Utils';
import './App.scss';
import './Themes.scss';
import './vendor/dragdroptouch/DragDropTouch.js';
import ThemeSelector from './ThemeSelector';
import { ReactComponent as HiddenBlock } from './svg/Hidden.svg';
import KeyboardInputModal from './KeyboardInputModal';
import ShareModal from './ShareModal';
import { ReactComponent as ShareIcon} from './svg/Share.svg';

import type {ActionName, KeyboardInputSchemeName} from './KeyboardInputSchemes';
import {findKeyboardEventSequenceMatches, isRepeatedEvent, isKeyboardInputSchemeName} from './KeyboardInputSchemes';
import { ReactComponent as AudioIcon } from './svg/Audio.svg';
import { ReactComponent as KeyboardModalToggleIcon} from './svg/Keyboard.svg';
import { ReactComponent as ThemeIcon } from './svg/Theme.svg';
import { ReactComponent as WorldIcon } from './svg/World.svg';
import { ReactComponent as ActionsMenuToggleIcon } from './svg/Simplification.svg'
import ProgramChangeController from './ProgramChangeController';
import PrivacyModal from './PrivacyModal';

import { ReactComponent as LogoContrast} from './svg/LogoContrast.svg';
import { ReactComponent as LogoGrayscale} from './svg/LogoGrayscale.svg';
import { ReactComponent as LogoDark} from './svg/LogoDark.svg';
import { ReactComponent as LogoMixedAndLight} from './svg/LogoMixedAndLight.svg';

function getThemeLogo (theme: ThemeName) {
    if (theme === "contrast") { return LogoContrast; }
    else if (theme === "gray") { return LogoGrayscale; }
    else if (theme === "dark") { return LogoDark; }

    return LogoMixedAndLight;
}

/* Dash connection removed for version 0.5
import BluetoothApiWarning from './BluetoothApiWarning';
*/

// Uncomment to use the FakeRobotDriver (see driver construction below also)
//import FakeRobotDriver from './FakeRobotDriver';

type AppContext = {
    bluetoothApiIsAvailable: boolean
};

type AppSettings = {
    language: string,
    addNodeExpandedMode: boolean,
    theme: ThemeName,
    world: WorldName
};

type AppProps = {
    intl: IntlShape,
    audioManager?: AudioManager
};

export type AppState = {
    programSequence: ProgramSequence,
    characterState: CharacterState,
    settings: AppSettings,
    arduinoConnectionStatus: DeviceConnectionStatus,
    showRobotConnectionError: boolean,
    selectedAction: ?string,
    isDraggingCommand: boolean,
    audioEnabled: boolean,
    announcementsEnabled: boolean,
    sonificationEnabled: boolean,
    actionPanelStepIndex: ?number,
    actionPanelFocusedOptionName: ?string,
    sceneDimensions: SceneDimensions,
    drawingEnabled: boolean,
    runningState: RunningState,
    disallowedActions: ActionToggleRegister,
    keyBindingsEnabled: boolean,
    keyboardInputSchemeName: KeyboardInputSchemeName,
    showKeyboardModal: boolean,
    showSoundOptionsModal: boolean,
    showThemeSelectorModal: boolean,
    showWorldSelector: boolean,
    showShareModal: boolean,
    showActionsSimplificationMenu: boolean,
    showPrivacyModal: boolean,
    startingX: number,
    startingY: number,
    startingDirection: number
};

export class App extends React.Component<AppProps, AppState> {
    version: string;
    appContext: AppContext;
    arduinoDriver: RobotDriver;
    sceneDimensions: SceneDimensions;
    interpreter: Interpreter;
    audioManager: AudioManager;
    focusTrapManager: FocusTrapManager;
    programSerializer: ProgramSerializer;
    characterStateSerializer: CharacterStateSerializer;
    disallowedActionsSerializer: DisallowedActionsSerializer;
    speedLookUp: Array<number>;
    pushStateTimeoutID: ?TimeoutID;
    speedControlRef: { current: null | HTMLElement };
    programBlockEditorRef: { current: any };
    sequenceInProgress: Array<KeyboardEvent>;
    announcementBuilder: AnnouncementBuilder;
    programChangeController: ProgramChangeController;
    defaultWorld: WorldName;

    constructor(props: any) {
        super(props);

        this.version = '1.6';

        this.appContext = {
            bluetoothApiIsAvailable: FeatureDetection.bluetoothApiIsAvailable()
        };

        this.sceneDimensions = new SceneDimensions(1, 12, 1, 8);

        this.interpreter = new Interpreter(1000, this);

        this.speedLookUp = [2000, 1500, 1000, 500, 250];

        this.programSerializer = new ProgramSerializer();

        this.characterStateSerializer = new CharacterStateSerializer(this.sceneDimensions);

        this.disallowedActionsSerializer = new DisallowedActionsSerializer();

        this.pushStateTimeoutID = null;

        this.sequenceInProgress = [];

        this.defaultWorld = 'Sketchpad';

        this.interpreter.addCommandHandler(
            'forward1',
            'moveCharacter',
            (stepTimeMs) => {
                // TODO: Enable announcements again.
                // this.audioManager.playAnnouncement('forward1', this.props.intl);
                this.setState((state) => {
                    const newCharacterState = state.characterState.forward(1, state.drawingEnabled);

                    // We have to start the sound here because this is where we know the new character state.
                    this.audioManager.playSoundForCharacterState("forward1", stepTimeMs, newCharacterState, this.sceneDimensions);

                    return {
                        characterState: newCharacterState
                    };
                });
                return Utils.makeDelayedPromise(stepTimeMs);
            }
        );

        this.interpreter.addCommandHandler(
            'forward2',
            'moveCharacter',
            (stepTimeMs) => {
                // TODO: Enable announcements again.
                // this.audioManager.playAnnouncement('forward2', this.props.intl);
                this.setState((state) => {
                    const newCharacterState = state.characterState.forward(2, state.drawingEnabled);

                    // We have to start the sound here because this is where we know the new character state.
                    this.audioManager.playSoundForCharacterState("forward2", stepTimeMs, newCharacterState, this.sceneDimensions);

                    return {
                        characterState: newCharacterState
                    };
                });
                return Utils.makeDelayedPromise(stepTimeMs);
            }
        );

        this.interpreter.addCommandHandler(
            'forward3',
            'moveCharacter',
            (stepTimeMs) => {
                // TODO: Enable announcements again.
                // this.audioManager.playAnnouncement('forward3', this.props.intl);
                this.setState((state) => {
                    const newCharacterState = state.characterState.forward(3, state.drawingEnabled);

                    // We have to start the sound here because this is where we know the new character state.
                    this.audioManager.playSoundForCharacterState("forward3", stepTimeMs, newCharacterState, this.sceneDimensions);
                    return {
                        characterState: newCharacterState
                    };
                });
                return Utils.makeDelayedPromise(stepTimeMs);
            }
        );

        this.interpreter.addCommandHandler(
            'backward1',
            'moveCharacter',
            (stepTimeMs) => {
                // TODO: Enable announcements again.
                // this.audioManager.playAnnouncement('backward1');
                this.setState((state) => {
                    const newCharacterState = state.characterState.backward(1, state.drawingEnabled);

                    // We have to start the sound here because this is where we know the new character state.
                    this.audioManager.playSoundForCharacterState("backward1", stepTimeMs, newCharacterState, this.sceneDimensions);
                    return {
                        characterState: newCharacterState
                    };
                });
                return Utils.makeDelayedPromise(stepTimeMs);
            }
        );

        this.interpreter.addCommandHandler(
            'backward2',
            'moveCharacter',
            (stepTimeMs) => {
                // TODO: Enable announcements again.
                // this.audioManager.playAnnouncement('backward2');
                this.setState((state) => {
                    const newCharacterState = state.characterState.backward(2, state.drawingEnabled);

                    // We have to start the sound here because this is where we know the new character state.
                    this.audioManager.playSoundForCharacterState("backward2", stepTimeMs, newCharacterState, this.sceneDimensions);
                    return {
                        characterState: newCharacterState
                    };
                });
                return Utils.makeDelayedPromise(stepTimeMs);
            }
        );

        this.interpreter.addCommandHandler(
            'backward3',
            'moveCharacter',
            (stepTimeMs) => {
                // TODO: Enable announcements again.
                // this.audioManager.playAnnouncement('backward3');
                this.setState((state) => {
                    const newCharacterState = state.characterState.backward(3, state.drawingEnabled);

                    // We have to start the sound here because this is where we know the new character state.
                    this.audioManager.playSoundForCharacterState("backward3", stepTimeMs, newCharacterState, this.sceneDimensions);
                    return {
                        characterState: newCharacterState
                    };
                });
                return Utils.makeDelayedPromise(stepTimeMs);
            }
        );

        this.interpreter.addCommandHandler(
            'left45',
            'moveCharacter',
            (stepTimeMs) => {
                // TODO: Enable announcements again.
                // this.audioManager.playAnnouncement('left45', this.props.intl);
                this.setState((state) => {
                    const newCharacterState = state.characterState.turnLeft(1);

                    // We have to start the sound here because this is where we know the new character state.
                    this.audioManager.playSoundForCharacterState("left45", stepTimeMs, newCharacterState, this.sceneDimensions);

                    return {
                        characterState: newCharacterState
                    };
                });
                return Utils.makeDelayedPromise(stepTimeMs);
            }
        );

        this.interpreter.addCommandHandler(
            'left90',
            'moveCharacter',
            (stepTimeMs) => {
                // TODO: Enable announcements again.
                // this.audioManager.playAnnouncement('left90', this.props.intl);
                this.setState((state) => {
                    const newCharacterState = state.characterState.turnLeft(2);

                    // We have to start the sound here because this is where we know the new character state.
                    this.audioManager.playSoundForCharacterState("left90", stepTimeMs, newCharacterState, this.sceneDimensions);

                    return {
                        characterState: newCharacterState
                    };
                });
                return Utils.makeDelayedPromise(stepTimeMs);
            }
        );

        this.interpreter.addCommandHandler(
            'left180',
            'moveCharacter',
            (stepTimeMs) => {
                // TODO: Enable announcements again.
                // this.audioManager.playAnnouncement('left180', this.props.intl);
                this.setState((state) => {
                    const newCharacterState = state.characterState.turnLeft(4);

                    // We have to start the sound here because this is where we know the new character state.
                    this.audioManager.playSoundForCharacterState("left180", stepTimeMs,  newCharacterState, this.sceneDimensions);

                    return {
                        characterState: newCharacterState
                    };
                });
                return Utils.makeDelayedPromise(stepTimeMs);
            }
        );

        this.interpreter.addCommandHandler(
            'right45',
            'moveCharacter',
            (stepTimeMs) => {
                // TODO: Enable announcements again.
                // this.audioManager.playAnnouncement('right45', this.props.intl);
                this.setState((state) => {
                    const newCharacterState = state.characterState.turnRight(1);

                    // We have to start the sound here because this is where we know the new character state.
                    this.audioManager.playSoundForCharacterState("right45", stepTimeMs, newCharacterState, this.sceneDimensions);

                    return {
                        characterState: newCharacterState
                    };
                });
                return Utils.makeDelayedPromise(stepTimeMs);
            }
        );

        this.interpreter.addCommandHandler(
            'right90',
            'moveCharacter',
            (stepTimeMs) => {
                // TODO: Enable announcements again.
                // this.audioManager.playAnnouncement('right90', this.props.intl);
                this.setState((state) => {
                    const newCharacterState = state.characterState.turnRight(2);

                    // We have to start the sound here because this is where we know the new character state.
                    this.audioManager.playSoundForCharacterState("right90", stepTimeMs, newCharacterState, this.sceneDimensions);

                    return {
                        characterState: newCharacterState
                    };
                });
                return Utils.makeDelayedPromise(stepTimeMs);
            }
        );

        this.interpreter.addCommandHandler(
            'right180',
            'moveCharacter',
            (stepTimeMs) => {
                // TODO: Enable announcements again.
                // this.audioManager.playAnnouncement('right180', this.props.intl);
                this.setState((state) => {
                    const newCharacterState = state.characterState.turnRight(4);

                    // We have to start the sound here because this is where we know the new character state.
                    this.audioManager.playSoundForCharacterState("right180", stepTimeMs, newCharacterState, this.sceneDimensions);

                    return {
                        characterState: newCharacterState
                    };
                });
                return Utils.makeDelayedPromise(stepTimeMs);
            }
        );

        // Initialize startingX, startingY, and startingDirection to the world starting position
        const startingX = getWorldProperties(this.defaultWorld).startingX;
        const startingY = getWorldProperties(this.defaultWorld).startingY;
        const startingDirection = getWorldProperties(this.defaultWorld).startingDirection;

        this.state = {
            programSequence: new ProgramSequence([], 0, 0, new Map()),
            characterState: this.makeStartingCharacterState(startingX, startingY, startingDirection),
            settings: {
                language: 'en',
                addNodeExpandedMode: true,
                theme: 'default',
                world: this.defaultWorld
            },
            arduinoConnectionStatus: 'notConnected',
            showRobotConnectionError: false,
            selectedAction: null,
            isDraggingCommand: false,
            audioEnabled: true,
            announcementsEnabled: true,
            sonificationEnabled: true,
            actionPanelStepIndex: null,
            actionPanelFocusedOptionName: null,
            sceneDimensions: this.sceneDimensions,
            drawingEnabled: true,
            runningState: 'stopped',
            disallowedActions: {},
            keyBindingsEnabled: false,
            showKeyboardModal: false,
            showSoundOptionsModal: false,
            showThemeSelectorModal: false,
            showWorldSelector: false,
            showShareModal: false,
            showActionsSimplificationMenu: false,
            showPrivacyModal: false,
            startingX: startingX,
            startingY: startingY,
            startingDirection: startingDirection,
            keyboardInputSchemeName: "controlalt"
        };

        // For FakeRobotDriver, replace with:
        // this.arduinoDriver = new FakeRobotDriver();
        this.arduinoDriver = new ArduinoDriver();

        if (props.audioManager) {
            this.audioManager = props.audioManager
        }
        else if (FeatureDetection.webAudioApiIsAvailable()) {
            this.audioManager = new AudioManagerImpl(this.state.audioEnabled, this.state.announcementsEnabled, this.state.sonificationEnabled);
        }
        else {
            this.audioManager = new FakeAudioManager();
        }

        this.focusTrapManager = new FocusTrapManager();

        this.announcementBuilder = new AnnouncementBuilder(this.props.intl);

        this.programChangeController = new ProgramChangeController(this,
            this.props.intl, this.audioManager);

        this.speedControlRef = React.createRef();
        this.programBlockEditorRef = React.createRef();
    }

    setStateSettings(settings: $Shape<AppSettings>) {
        this.setState((state) => {
            return {
                settings: Object.assign({}, state.settings, settings)
            }
        });
    }

    getSelectedCommandName() {
        if (this.state.selectedAction !== null) {
            return this.state.selectedAction;
        } else {
            return null;
        }
    }

    editingIsDisabled(): boolean {
        return !(this.state.runningState === 'stopped'
            || this.state.runningState === 'paused');
    }

    refreshIsDisabled(): boolean {
        return this.state.runningState !== 'stopped';
    }

    // API for Interpreter

    getRunningState(): RunningState {
        return this.state.runningState;
    }

    setRunningState(runningState: RunningState): void {
        this.setState((state) => {
            // If stop is requested when we are in the 'paused' state,
            // then go straight to 'stopped'
            if (runningState === 'stopRequested' && state.runningState === 'paused') {
                return { runningState: 'stopped' };
            } else {
                return { runningState };
            }
        });
    }

    getProgramSequence(): ProgramSequence {
        return this.state.programSequence;
    }

    advanceProgramCounter(callback: () => void): void {
        this.setState((state) => {
            return {
                programSequence: state.programSequence.advanceProgramCounter(false)
            }
        }, callback);
    }

    // Handlers

    handleProgramSequenceChange = (programSequence: ProgramSequence) => {
        this.setState({
            programSequence: programSequence
        });
    };

    handleProgramBlockEditorInsertSelectedAction = (index: number, selectedAction: ?string) => {
        this.programChangeController.insertSelectedActionIntoProgram(
            this.programBlockEditorRef.current,
            index,
            selectedAction
        );
    };

    handleProgramBlockEditorDeleteStep = (index: number, command: string) => {
        this.programChangeController.deleteProgramStep(
            this.programBlockEditorRef.current,
            index,
            command
        );
    };

    handleProgramBlockEditorReplaceStep = (index: number, selectedAction: ?string) => {
        this.programChangeController.replaceProgramStep(
            this.programBlockEditorRef.current,
            index,
            selectedAction
        );
    };

    handleProgramBlockEditorMoveStepNext = (indexFrom: number, commandAtIndexFrom: string) => {
        this.programChangeController.moveProgramStepNext(
            this.programBlockEditorRef.current,
            indexFrom,
            commandAtIndexFrom,
            'focusActionPanel'
        )
    };

    handleProgramBlockEditorMoveStepPrevious = (indexFrom: number, commandAtIndexFrom: string) => {
        this.programChangeController.moveProgramStepPrevious(
            this.programBlockEditorRef.current,
            indexFrom,
            commandAtIndexFrom,
            'focusActionPanel'
        )
    };

    handlePlay = () => {
        switch (this.state.runningState) {
            case 'running':
                this.setState({
                    runningState: 'pauseRequested',
                    actionPanelStepIndex: null
                });
                break;
            case 'pauseRequested': // Fall through
            case 'paused':
                this.setState({
                    runningState: 'running',
                    actionPanelStepIndex: null
                });
                break;
            case 'stopRequested': // Fall through
            case 'stopped':
                this.setState((state) => {
                    return {
                        programSequence: state.programSequence.initiateProgramRun(),
                        runningState: 'running',
                        actionPanelStepIndex: null
                    };
                });
                break;
            default:
                break;
        }
    };

    handleStop = () => {
        this.setRunningState('stopRequested');
    };

    handleClickConnectArduino = () => {
        this.setState({
            arduinoConnectionStatus: 'connecting',
            showRobotConnectionError: false
        });
        this.arduinoDriver.connect(this.handleArduinoDisconnect).then(() => {
            this.setState({
                arduinoConnectionStatus: 'connected'
            });
        }, (error: Error) => {
            /* eslint-disable no-console */
            console.log('ERROR');
            console.log(error.name);
            console.log(error.message);
            /* eslint-enable no-console */
            this.setState({
                arduinoConnectionStatus: 'notConnected',
                showRobotConnectionError: true
            });
        });
    };

    handleCancelArduinoConnection = () => {
        this.setState({
            showRobotConnectionError: false
        });
    };

    handleArduinoDisconnect = () => {
        this.setState({
            arduinoConnectionStatus : 'notConnected'
        });
    };

    handleCommandFromCommandPalette = (command: string) => {
        this.setState({
            selectedAction: command
        });
    };

    handleDragStartCommand = (command: string) => {
        this.setState({
            isDraggingCommand: true,
            selectedAction: command,
            actionPanelStepIndex: null
        });
    };

    handleDragEndCommand = () => {
        this.setState({ isDraggingCommand: false });
    };

    handleChangeActionPanelStepIndexAndOption = (index: ?number, focusedOptionName: ?string) => {
        this.setState({
            actionPanelStepIndex: index,
            actionPanelFocusedOptionName: focusedOptionName
        });
    };

    handleChangeAddNodeExpandedMode = (isAddNodeExpandedMode: boolean) => {
        this.setStateSettings({
            addNodeExpandedMode: isAddNodeExpandedMode
        });
    };

    handleRootClick = (e: SyntheticInputEvent<HTMLInputElement>) => {
        let element = e.target;
        // Walk up the document tree until we hit the top, or we find that
        // we are within an action panel group area
        while (element != null && element.dataset) {
            if (element.dataset.actionpanelgroup) {
                // We are within an action panel group area, stop looking
                return;
            }
            element = element.parentElement;
        }
        // We hit the top, close the action panel
        this.setState({
            actionPanelStepIndex: null
        });
    };

    // Global shortcut handling.
    // TODO: Convert to use keyboardEventMatchesKeyDef for each command in turn.
    handleDocumentKeyDown = (e: KeyboardEvent) => {
        if (this.state.keyBindingsEnabled) {
            if (e.key === 'Escape') {
                this.sequenceInProgress = [];
                return;
            }

            const isOnlyModifier = ["Shift", "Control", "Alt"].indexOf(e.key) !== -1;
            let isRepeat = false;
            if (this.sequenceInProgress.length) {
                isRepeat = isRepeatedEvent(this.sequenceInProgress[this.sequenceInProgress.length - 1], e);
            }

            if (!isOnlyModifier && !isRepeat) {
                this.sequenceInProgress.push(e);

                const matchingKeyboardAction: ActionName | "partial" | false = findKeyboardEventSequenceMatches(this.sequenceInProgress, this.state.keyboardInputSchemeName);
                if (matchingKeyboardAction === false || matchingKeyboardAction !== "partial") {
                    this.sequenceInProgress = [];
                }

                if (matchingKeyboardAction !== false) {
                    e.preventDefault();
                    switch (matchingKeyboardAction) {
                        case("showHide"):
                            this.setState((currentState) => {
                                return { showKeyboardModal: !(currentState.showKeyboardModal) };
                            });
                            break;
                        case("toggleFeedbackAnnouncements"):
                            // We have to use the function form here as our change is based on the current state.
                            this.setState((currentState) => {
                                return { announcementsEnabled: !(currentState.announcementsEnabled) };
                            });
                            break;
                        case("addCommand"): {
                            if (!this.editingIsDisabled()) {
                                const currentElement = document.activeElement;
                                if (currentElement) {
                                    if (currentElement.dataset.controltype === 'programStep' ||
                                        currentElement.dataset.controltype === 'addNode') {
                                        const index = currentElement.dataset.controltype === 'programStep' ?
                                            parseInt(currentElement.dataset.stepnumber, 10) + 1:
                                            parseInt(currentElement.dataset.stepnumber, 10);
                                        if (index != null) {
                                            this.programChangeController.insertSelectedActionIntoProgram(
                                                this.programBlockEditorRef.current,
                                                index,
                                                this.state.selectedAction
                                            );
                                        }
                                    }
                                }
                            }
                            break;
                        }
                        case("addCommandToBeginning"):
                            if (!this.editingIsDisabled()) {
                                this.programChangeController.insertSelectedActionIntoProgram(
                                    this.programBlockEditorRef.current,
                                    0,
                                    this.state.selectedAction
                                );
                            }
                            break;
                        case("addCommandToEnd"):
                            if (!this.editingIsDisabled()) {
                                this.programChangeController.addSelectedActionToProgramEnd(
                                    this.programBlockEditorRef.current,
                                    this.state.selectedAction
                                );
                            }
                            break;
                        case("deleteCurrentStep"):
                            if (!this.editingIsDisabled()) {
                                const currentElement = document.activeElement;
                                if (currentElement) {
                                    if (currentElement.dataset.controltype === 'programStep') {
                                        const index = parseInt(currentElement.dataset.stepnumber, 10);
                                        if (index != null) {
                                            this.programChangeController.deleteProgramStep(
                                                this.programBlockEditorRef.current,
                                                index,
                                                currentElement.dataset.command
                                            );
                                        }
                                    }
                                }
                            }
                            break;
                        case("replaceCurrentStep"):
                            if (!this.editingIsDisabled()) {
                                const currentElement = document.activeElement;
                                if (currentElement) {
                                    if (currentElement.dataset.controltype === 'programStep') {
                                        const index = parseInt(currentElement.dataset.stepnumber, 10);
                                        if (index != null) {
                                            this.programChangeController.replaceProgramStep(
                                                this.programBlockEditorRef.current,
                                                index,
                                                this.state.selectedAction
                                            );
                                        }
                                    }
                                }
                            }
                            break;
                        case("deleteAll"): {
                            if (!this.editingIsDisabled()) {
                                const newProgramSequence = this.state.programSequence.updateProgram([]);
                                this.handleProgramSequenceChange(newProgramSequence);
                            }
                            break;
                        }
                        case("announceScene"):
                            const ariaLiveRegion = document.getElementById('character-position');
                            if (ariaLiveRegion) {
                                if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
                                    window.speechSynthesis.cancel();
                                }
                                const utterance = new SpeechSynthesisUtterance(ariaLiveRegion.innerText);
                                window.speechSynthesis.speak(utterance);
                            }
                            break;
                        case("playPauseProgram"):
                            if (this.state.programSequence.getProgramLength() > 0) {
                                this.handlePlay();
                            }
                            break;
                        case("refreshScene"):
                            if (!this.refreshIsDisabled()) {
                                this.handleRefresh();
                            }
                            break;
                        case("stopProgram"):
                            if (this.state.runningState !== 'stopped' && this.state.runningState !== 'stopRequested') {
                                this.handleStop();
                            }
                            break;
                        case("decreaseProgramSpeed"):
                            this.changeProgramSpeedIndex(this.speedLookUp.indexOf(this.interpreter.stepTimeMs) - 1);
                            break;
                        case("increaseProgramSpeed"):
                            this.changeProgramSpeedIndex(this.speedLookUp.indexOf(this.interpreter.stepTimeMs) + 1);
                            break;
                        case("selectForward1"):
                            this.setState({ "selectedAction": "forward1" });
                            break;
                        case("selectBackward1"):
                            this.setState({ "selectedAction": "backward1" });
                            break;
                        case("selectLeft45"):
                            this.setState({ "selectedAction": "left45" });
                            break;
                        case("selectLeft90"):
                            this.setState({ "selectedAction": "left90" });
                            break;
                        case("selectRight45"):
                            this.setState({ "selectedAction": "right45" });
                            break;
                        case("selectRight90"):
                            this.setState({ "selectedAction": "right90" });
                            break;
                        case("selectLoop"):
                            this.setState({ "selectedAction": "loop" });
                            break;
                        case("focusActions"):
                            Utils.focusByQuerySelector(".command-block");
                            break;
                        case("focusAppHeader"):
                            Utils.focusByQuerySelector(".keyboard-shortcut-focus__app-header");
                            break;
                        case("focusAddNodeToggle"):
                            Utils.focusByQuerySelector(".ProgramBlockEditor__add-node-toggle-switch");
                            break;
                        case("focusCharacterPositionControls"):
                            Utils.focusByQuerySelector(".CharacterPositionController__character-position-button");
                            break;
                        case("focusCharacterColumnInput"):
                            Utils.focusByQuerySelector(".ProgramBlock__character-position-coordinate-box-column");
                            break;
                        case("focusCharacterRowInput"):
                            Utils.focusByQuerySelector(".ProgramBlock__character-position-coordinate-box-row");
                            break;
                        case("focusPreviousProgramBlock"): {
                            this.focusPreviousProgramBlock();
                            break;
                        }
                        case("focusNextProgramBlock"): {
                            this.focusNextProgramBlock();
                            break;
                        }
                        case("focusLoopIterationsInput"):
                            if (!this.editingIsDisabled()) {
                                const currentElement = document.activeElement;
                                if (currentElement) {
                                    if (currentElement.dataset.controltype === 'programStep' && currentElement.dataset.command === 'startLoop') {
                                        const iterationsInput = currentElement.querySelector('input');
                                        if (iterationsInput != null && iterationsInput.focus) {
                                            iterationsInput.focus();
                                        }
                                    }
                                }
                            }
                            break;
                        case("focusPlayShare"):
                            Utils.focusByQuerySelector(".PlayButton--play");
                            break;
                        case("focusProgramSequence"):
                            Utils.focusByQuerySelector(".AddNode__expanded-button");
                            break;
                        case("focusScene"):
                            Utils.focusByQuerySelector(".PenDownToggleSwitch");
                            break;
                        case("focusWorldSelector"):
                            Utils.focusByQuerySelector(".keyboard-shortcut-focus__world-selector");
                            break;
                        case("moveToPreviousStep"):
                            if (!this.editingIsDisabled()) {
                                const currentElement = document.activeElement;
                                if (currentElement) {
                                    if (currentElement.dataset.controltype === 'programStep') {
                                        const index = parseInt(currentElement.dataset.stepnumber, 10);
                                        if (index != null) {
                                            this.programChangeController.moveProgramStepPrevious(
                                                this.programBlockEditorRef.current,
                                                index,
                                                currentElement.dataset.command,
                                                'focusBlockMoved'
                                            )
                                        }
                                    }
                                }
                            }
                            break;
                        case("moveToNextStep"):
                            if (!this.editingIsDisabled()) {
                                const currentElement = document.activeElement;
                                if (currentElement) {
                                    if (currentElement.dataset.controltype === 'programStep') {
                                        const index = parseInt(currentElement.dataset.stepnumber, 10);
                                        if (index != null) {
                                            this.programChangeController.moveProgramStepNext(
                                                this.programBlockEditorRef.current,
                                                index,
                                                currentElement.dataset.command,
                                                'focusBlockMoved'
                                            )
                                        }
                                    }
                                }
                            }
                            break;
                        case("moveCharacterLeft"):
                            if (!this.editingIsDisabled()) {
                                this.handleChangeCharacterPosition('left');
                            }
                            break;
                        case("moveCharacterRight"):
                            if (!this.editingIsDisabled()) {
                                this.handleChangeCharacterPosition('right');
                            }
                            break;
                        case("moveCharacterUp"):
                            if (!this.editingIsDisabled()) {
                                this.handleChangeCharacterPosition('up');
                            }
                            break;
                        case("moveCharacterDown"):
                            if (!this.editingIsDisabled()) {
                                this.handleChangeCharacterPosition('down');
                            }
                            break;
                        case("turnCharacterLeft"):
                            if (!this.editingIsDisabled()) {
                                this.handleChangeCharacterPosition('turnLeft');
                            }
                            break;
                        case("turnCharacterRight"):
                            if (!this.editingIsDisabled()) {
                                this.handleChangeCharacterPosition('turnRight');
                            }
                            break;
                        case("changeToDefaultTheme"):
                            this.setStateSettings({theme: "default"});
                            break;
                        case("changeToLightTheme"):
                            this.setStateSettings({theme: "light"});
                            break;
                        case("changeToDarkTheme"):
                            this.setStateSettings({theme: "dark"});
                            break;
                        case("changeToGrayscaleTheme"):
                            this.setStateSettings({theme: "gray"});
                            break;
                        case("changeToHighContrastTheme"):
                            this.setStateSettings({theme: "contrast"});
                            break;
                        default:
                            break;
                    }
                }
            }
            else if (isRepeat) {
                e.preventDefault();
            }
        }
    };

    focusPreviousProgramBlock() {
        const programBlocks = document.querySelectorAll('.ProgramBlockEditor__program-block');
        if (programBlocks.length > 0) {
            const currentElement = document.activeElement;
            if (currentElement && currentElement.dataset.controltype === 'programStep') {
                const currentStepNumber = currentElement.dataset.stepnumber;
                if (currentStepNumber != null) {
                    this.focusBlockBefore(parseInt(currentStepNumber, 10), programBlocks);
                }
            } else if (currentElement && currentElement.dataset.controltype === 'addNode') {
                const currentAddNodeNumber = currentElement.dataset.stepnumber;
                if (currentAddNodeNumber != null) {
                    this.focusBlockBefore(parseInt(currentAddNodeNumber, 10), programBlocks);
                }
            } else if (this.state.actionPanelStepIndex != null) {
                this.focusBlockBefore(this.state.actionPanelStepIndex, programBlocks);
            } else {
                // If focus is not set, or set on an element other than a
                // program block or add node, focus the last step of program
                Utils.focusLastInNodeList(programBlocks);
            }
        }
        this.setState({ actionPanelStepIndex: null });
    }

    focusBlockBefore(index: number, programBlocks: NodeList<HTMLElement>) {
        if (index > 0) {
            const previousBlock = programBlocks[index - 1];
            if (previousBlock && previousBlock.focus) {
                previousBlock.focus();
            }
        } else {
            // Wrap around to the last step of the program
            Utils.focusLastInNodeList(programBlocks);
        }
    }

    focusNextProgramBlock() {
        const programBlocks = document.querySelectorAll('.ProgramBlockEditor__program-block');
        if (programBlocks.length > 0) {
            const currentElement = document.activeElement;
            if (currentElement && currentElement.dataset.controltype === 'programStep') {
                const currentStepNumber = currentElement.dataset.stepnumber;
                if (currentStepNumber != null) {
                    this.focusBlockAfter(parseInt(currentStepNumber, 10), programBlocks);
                }
            } else if (currentElement && currentElement.dataset.controltype === 'addNode') {
                const currentAddNodeNumber = currentElement.dataset.stepnumber;
                if (currentAddNodeNumber != null) {
                    // We pass stepmumber - 1 to focusBlockAfter() for the add
                    // node case as the block that we want to focus has the same
                    // stepnumber as the add node
                    this.focusBlockAfter(parseInt(currentAddNodeNumber, 10) - 1, programBlocks);
                }
            } else if (this.state.actionPanelStepIndex != null) {
                this.focusBlockAfter(this.state.actionPanelStepIndex, programBlocks);
            } else {
                // If focus is not set, or set on an element other than a
                // program block or add node, focus the first step of program
                Utils.focusFirstInNodeList(programBlocks);
            }
        }
        this.setState({ actionPanelStepIndex: null });
    }

    focusBlockAfter(index: number, programBlocks: NodeList<HTMLElement>) {
        if (index < programBlocks.length - 1) {
            const nextBlock = programBlocks[index + 1];
            if (nextBlock && nextBlock.focus) {
                nextBlock.focus();
            }
        } else {
            // Wrap around to the first step of the program
            Utils.focusFirstInNodeList(programBlocks);
        }
    }

    handleKeyboardModalClose = () => {
        this.setState({showKeyboardModal: false});
    };

    handleClickKeyboardIcon = () => {
        this.setState({ showKeyboardModal: true});
    };

    handleClickSoundIcon = () => {
        this.setState({ showSoundOptionsModal: true });
    }

    handleSoundOptionsModalClose = () => {
        this.setState({ showSoundOptionsModal: false });
    }

    handleChangeSoundOptions = (audioEnabled: boolean, announcementsEnabled: boolean, sonificationEnabled: boolean) => {
        this.setState({ audioEnabled, announcementsEnabled, sonificationEnabled, showSoundOptionsModal: false });
    }

    handleClickThemeSelectorIcon = () => {
        this.setState({ showThemeSelectorModal: true });
    }

    // Focus trap escape key handling.
    handleRootKeyDown = (e: SyntheticKeyboardEvent<HTMLInputElement>) => {
        this.focusTrapManager.handleKeyDown(e);
    }

    handleTogglePenDown = (drawingEnabled: boolean) => {
        this.setState({
            drawingEnabled: drawingEnabled
        });
    }

    changeProgramSpeedIndex = (newSpeedIndex: number) => {
        if (newSpeedIndex >= 0 && newSpeedIndex <= (this.speedLookUp.length - 1)) {
            this.interpreter.setStepTime(this.speedLookUp[newSpeedIndex]);
            if (this.speedControlRef.current) {
                // $FlowFixMe: Flow doesn't believe that we have sufficiently ensured that current !== null.
                this.speedControlRef.current.value = (newSpeedIndex + 1).toString();
            }
        }
    }

    handleChangeProgramSpeed = (stepTimeMs: number) => {
        this.interpreter.setStepTime(stepTimeMs);
    }

    renderCommandBlocks = (commands: Array<DisplayedCommandName>) => {
        const commandBlocks = [];

        for (const [index, value] of commands.entries()) {
            const isDisallowed = this.state.disallowedActions[value];
            if (isDisallowed) {
                commandBlocks.push(
                    <div
                        className='command-block--hidden'
                        key={`CommandBlock-${index}`}
                        aria-hidden='true'>
                        <HiddenBlock />
                    </div>
                );
            }
            else {
                commandBlocks.push(
                    <CommandPaletteCommand
                        key={`CommandBlock-${index}`}
                        commandName={value}
                        selectedCommandName={this.getSelectedCommandName()}
                        audioManager={this.audioManager}
                        isDraggingCommand={this.state.isDraggingCommand}
                        onSelect={this.handleCommandFromCommandPalette}
                        onDragStart={this.handleDragStartCommand}
                        onDragEnd={this.handleDragEndCommand}/>
                );
            }

        }

        return commandBlocks;
    }

    makeStartingCharacterState(startingX: number, startingY: number, startingDirection: number): CharacterState {
        return new CharacterState(
            startingX,
            startingY,
            startingDirection,
            [],
            this.sceneDimensions
        );
    }

    handleRefresh = () => {
        this.setState((state) => {
            return {
                characterState: this.makeStartingCharacterState(
                    state.startingX,
                    state.startingY,
                    state.startingDirection
                )
            };
        });
    }

    handleSelectTheme = (theme: ThemeName) => {
        this.setStateSettings({theme});
    }

    handleChangeTheme = (theme: ThemeName) => {
        this.setState({
            showThemeSelectorModal: false,
            settings: Object.assign({}, this.state.settings, {theme})
        });
    }

    handleChangeCharacterPosition = (positionName: ?string) => {
        switch(positionName) {
            case 'turnLeft':
                this.setState((state) => {
                    const updatedCharacterState = state.characterState.turnLeft(1);
                    return {
                        characterState: updatedCharacterState,
                        startingX: updatedCharacterState.xPos,
                        startingY: updatedCharacterState.yPos,
                        startingDirection: updatedCharacterState.direction,
                    }
                });
                break;
            case 'turnRight':
                this.setState((state) => {
                    const updatedCharacterState = state.characterState.turnRight(1);
                    return {
                        characterState: updatedCharacterState,
                        startingX: updatedCharacterState.xPos,
                        startingY: updatedCharacterState.yPos,
                        startingDirection: updatedCharacterState.direction,
                    }
                });
                break;
            case 'up':
                this.setState((state) => {
                    const updatedCharacterState = state.characterState.moveUpPosition();
                    return {
                        characterState: updatedCharacterState,
                        startingX: updatedCharacterState.xPos,
                        startingY: updatedCharacterState.yPos,
                        startingDirection: updatedCharacterState.direction,
                    }
                });
                break;
            case 'right':
                this.setState((state) => {
                    const updatedCharacterState = state.characterState.moveRightPosition();
                    return {
                        characterState: updatedCharacterState,
                        startingX: updatedCharacterState.xPos,
                        startingY: updatedCharacterState.yPos,
                        startingDirection: updatedCharacterState.direction,
                    }
                });
                break;
            case 'down':
                this.setState((state) => {
                    const updatedCharacterState = state.characterState.moveDownPosition();
                    return {
                        characterState: updatedCharacterState,
                        startingX: updatedCharacterState.xPos,
                        startingY: updatedCharacterState.yPos,
                        startingDirection: updatedCharacterState.direction,
                    }
                });
                break;
            case 'left':
                this.setState((state) => {
                    const updatedCharacterState = state.characterState.moveLeftPosition();
                    return {
                        characterState: updatedCharacterState,
                        startingX: updatedCharacterState.xPos,
                        startingY: updatedCharacterState.yPos,
                        startingDirection: updatedCharacterState.direction,
                    }
                });
                break;
            default:
                break;
        }
    }

    handleChangeCharacterXPosition = (columnLabel: string) => {
        const updatedCharacterState = this.state.characterState.changeXPosition(columnLabel);
        this.setState({
            characterState: updatedCharacterState,
            startingX: updatedCharacterState.xPos,
            startingY: updatedCharacterState.yPos,
            startingDirection: updatedCharacterState.direction,
        });
    }

    handleChangeCharacterYPosition = (rowLabel: string) => {
        const updatedCharacterState = this.state.characterState.changeYPosition(parseInt(rowLabel, 10));
        this.setState({
            characterState: updatedCharacterState,
            startingX: updatedCharacterState.xPos,
            startingY: updatedCharacterState.yPos,
            startingDirection: updatedCharacterState.direction,
        });
    }

    handleChangeKeyboardInputScheme = (keyboardInputSchemeName: KeyboardInputSchemeName) => {
        this.setState({keyboardInputSchemeName});
    }

    handleChangeKeyBindingsEnabled = (keyBindingsEnabled: boolean) => {
        this.setState({keyBindingsEnabled: keyBindingsEnabled});
    }

    handleClickActionsSimplificationIcon = () => {
        if (!this.editingIsDisabled()) {
            this.setState({
                showActionsSimplificationMenu: true
            });
        }
    }

    handleChangeDisallowedActions = (disallowedActions: ActionToggleRegister) => {
        this.setState({
            showActionsSimplificationMenu: false,
            disallowedActions: disallowedActions
        });
    }

    handleCancelActionsSimplificationMenu = () => {
        this.setState({ showActionsSimplificationMenu: false});
    }

    //World handlers

    handleClickWorldIcon = () => {
        this.setState({
            showWorldSelector: true
        });
    }

    handleSelectWorld = (world: WorldName) => {
        this.setStateSettings({world});
    }

    handleChangeWorld = (world: WorldName) => {
        this.setState((state) => {
            return {
                showWorldSelector: false,
                settings: Object.assign({}, state.settings, {world})
            };
        });
    }

    handleShareButtonClick = (event: Event) => {
        event.preventDefault();
        this.setState({ showShareModal: true});

    }

    handleCloseShare = () => {
        this.setState({ showShareModal: false });
    }

    handleClickPrivacyButton = () => {
        this.setState({ showPrivacyModal: true });
    }

    handleClosePrivacyModal = () => {
        this.setState({ showPrivacyModal: false });
    }

    render() {
        const Logo = getThemeLogo(this.state.settings.theme);
        return (
            <React.Fragment>
                <div
                    className='App__container'
                    role='main'
                    onClick={this.handleRootClick}
                    onKeyDown={this.handleRootKeyDown}>
                    <header className='App__header'>
                        <div className='App__header-row'>
                            <h1 className='App__logo-container'>
                                <a
                                    className='keyboard-shortcut-focus__app-header'
                                    href='https://weavly.org/learn/resources/facilitating-a-weavly-coding-workshop-beginners/'
                                    aria-label={this.props.intl.formatMessage({id: 'App.appHeading.link'})}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                >
                                    <Logo alt={this.props.intl.formatMessage({id: 'App.appHeading.link'})}/>
                                </a>
                            </h1>
                            <div className='App__PrivacyButtonContainer'>
                                <button
                                    aria-label={this.props.intl.formatMessage({id: 'App.privacyModalToggle.ariaLabel'})}
                                    className="App__PrivacyModal__toggle-button"
                                    onClick={this.handleClickPrivacyButton}
                                >
                                    <FormattedMessage id='App.privacyModalToggle'/>
                                </button>
                            </div>
                            <div className='App__header-menu'>
                                <IconButton
                                    className="App__header-soundOptions"
                                    ariaLabel={this.props.intl.formatMessage({ id: 'SoundOptionsModal.title' })}
                                    onClick={this.handleClickSoundIcon}
                                >
                                    <AudioIcon className='App__header-soundOptions-icon'/>
                                </IconButton>
                                <IconButton
                                    className="App__header-themeSelectorIcon"
                                    ariaLabel={this.props.intl.formatMessage({ id: 'ThemeSelector.iconButton' })}
                                    onClick={this.handleClickThemeSelectorIcon}
                                >
                                    <ThemeIcon className='App__header-theme-icon'/>
                                </IconButton>
                                <IconButton
                                    className="App__header-keyboardMenuIcon"
                                    ariaLabel={this.props.intl.formatMessage({ id: 'KeyboardInputModal.ShowHide.AriaLabel' })}
                                    onClick={this.handleClickKeyboardIcon}
                                >
                                    <KeyboardModalToggleIcon className='App__header-keyboard-icon'/>
                                </IconButton>

                                <IconButton className="App__ActionsMenu__toggle-button"
                                    ariaLabel={this.props.intl.formatMessage({ id: 'ActionsMenu.toggleActionsMenu' })}
                                    disabled={this.editingIsDisabled()}
                                    onClick={this.handleClickActionsSimplificationIcon}
                                >
                                    <ActionsMenuToggleIcon className='App__header-actionsMenu-icon'/>
                                </IconButton>
                            </div>
                            {/* Dash connection removed for version 0.5
                            <DeviceConnectControl
                                disabled={
                                    !this.appContext.bluetoothApiIsAvailable ||
                                    this.state.dashConnectionStatus === 'connected' }
                                connectionStatus={this.state.dashConnectionStatus}
                                onClickConnect={this.handleClickConnectDash}>
                                <FormattedMessage id='App.connectToDash' />
                            </DeviceConnectControl>
                            */}
                        </div>
                    </header>
                    {/* Dash connection removed for version 0.5
                    {!this.appContext.bluetoothApiIsAvailable &&
                        <Row className='App__bluetooth-api-warning-section'>
                            <Col>
                                <BluetoothApiWarning/>
                            </Col>
                        </Row>
                    }
                    */}
                    <div className='App__scene-container'>
                        <h2 className='sr-only' >
                            <FormattedMessage id='Scene.heading' />
                        </h2>
                        <Scene
                            dimensions={this.state.sceneDimensions}
                            characterState={this.state.characterState}
                            theme={this.state.settings.theme}
                            world={this.state.settings.world}
                            startingX={this.state.startingX}
                            startingY={this.state.startingY}
                            runningState={this.state.runningState}
                        />
                    </div>
                    <div className="App__world-container">
                        <h2 className='sr-only' >
                            <FormattedMessage id='WorldSelector.heading' />
                        </h2>
                        <div className="App__world-selector">
                            <IconButton
                                className='keyboard-shortcut-focus__world-selector'
                                ariaLabel={this.props.intl.formatMessage({ id: 'WorldSelector' })}
                                onClick={this.handleClickWorldIcon}
                            >
                                <WorldIcon className='App__world-selector-icon'/>
                            </IconButton>
                            <DeviceConnectControl
                                disabled={
                                    !this.appContext.bluetoothApiIsAvailable ||
                                    this.state.arduinoConnectionStatus === 'connected' }
                                connectionStatus={this.state.arduinoConnectionStatus}
                                onClickConnect={this.handleClickConnectArduino}>
                                <FormattedMessage id='App.connectToArduino' />
                            </DeviceConnectControl>
                        </div>

                        <div className='App__PenDownToggleSwitch-container'>
                            <PenDownToggleSwitch
                                className='App__penDown-toggle-switch'
                                value={this.state.drawingEnabled}
                                onChange={this.handleTogglePenDown}/>
                        </div>

                        <CharacterPositionController
                            characterState={this.state.characterState}
                            editingDisabled={this.editingIsDisabled()}
                            theme={this.state.settings.theme}
                            world={this.state.settings.world}
                            onChangeCharacterPosition={this.handleChangeCharacterPosition}
                            onChangeCharacterXPosition={this.handleChangeCharacterXPosition}
                            onChangeCharacterYPosition={this.handleChangeCharacterYPosition} />
                    </div>
                    <div className='App__command-palette'>
                        <div className='App__ActionsMenu__header'>
                            <h2 className='App__ActionsMenu__header-heading'>
                                <FormattedMessage id='ActionsMenu.title' />
                            </h2>
                        </div>
                        <div className='App__command-palette-command-container'>
                            <div className='App__command-palette-section'>
                                <div className='App__command-palette-section-heading-container'>
                                    <h3 className='App__command-palette-section-heading'>
                                        <FormattedMessage id='CommandPalette.movementsTitle'/>
                                    </h3>
                                </div>
                                <div className='App__command-palette-section-body'>
                                    <div className='App__command-palette-commands'>
                                        {this.renderCommandBlocks(['forward1'])}
                                    </div>
                                    <div className='App__command-palette-commands'>
                                        {this.renderCommandBlocks(['backward1'])}
                                    </div>
                                    <div className='App__command-palette-commands'>
                                        {this.renderCommandBlocks([
                                            'left45', 'left90'
                                        ])}
                                    </div>
                                    <div className='App__command-palette-commands'>
                                        {this.renderCommandBlocks([
                                            'right45', 'right90'
                                        ])}
                                    </div>
                                </div>
                            </div>

                            <div className='App__command-palette-section'>
                                <div className='App__command-palette-section-heading-container'>
                                    <h3 className='App__command-palette-section-heading'>
                                        <FormattedMessage id='CommandPalette.controlsTitle'/>
                                    </h3>
                                </div>

                                <div className='App__command-palette-section-body'>
                                    <div className='App__command-palette-controls'>
                                        {this.renderCommandBlocks([
                                            'loop'
                                        ])}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className='App__program-block-editor'>
                        <ProgramBlockEditor
                            ref={this.programBlockEditorRef}
                            actionPanelStepIndex={this.state.actionPanelStepIndex}
                            actionPanelFocusedOptionName={this.state.actionPanelFocusedOptionName}
                            characterState={this.state.characterState}
                            editingDisabled={this.editingIsDisabled()}
                            programSequence={this.state.programSequence}
                            runningState={this.state.runningState}
                            keyboardInputSchemeName={this.state.keyboardInputSchemeName}
                            selectedAction={this.state.selectedAction}
                            isDraggingCommand={this.state.isDraggingCommand}
                            audioManager={this.audioManager}
                            focusTrapManager={this.focusTrapManager}
                            addNodeExpandedMode={this.state.settings.addNodeExpandedMode}
                            theme={this.state.settings.theme}
                            world={this.state.settings.world}
                            scrollRightPaddingPx={256}
                            scrollLeftPaddingPx={128}
                            scrollTimeThresholdMs={400}
                            onChangeProgramSequence={this.handleProgramSequenceChange}
                            onInsertSelectedActionIntoProgram={this.handleProgramBlockEditorInsertSelectedAction}
                            onDeleteProgramStep={this.handleProgramBlockEditorDeleteStep}
                            onReplaceProgramStep={this.handleProgramBlockEditorReplaceStep}
                            onMoveProgramStepNext={this.handleProgramBlockEditorMoveStepNext}
                            onMoveProgramStepPrevious={this.handleProgramBlockEditorMoveStepPrevious}
                            onChangeActionPanelStepIndexAndOption={this.handleChangeActionPanelStepIndexAndOption}
                            onChangeAddNodeExpandedMode={this.handleChangeAddNodeExpandedMode}
                        />
                    </div>
                    <div className='App__playAndShare-background' />
                    <div className='App__playAndShare-container'>
                        <h2 className='sr-only' >
                            <FormattedMessage id='PlayControls.heading' />
                        </h2>
                        <div className='App__playControl-container'>
                            <div className='App__playButton-container'>
                                <RefreshButton
                                    className='App__playControlButton'
                                    disabled={this.refreshIsDisabled()}
                                    onClick={this.handleRefresh}
                                />
                                <PlayButton
                                    className='App__playControlButton'
                                    interpreterIsRunning={this.state.runningState === 'running'}
                                    disabled={this.state.programSequence.getProgramLength() === 0}
                                    onClick={this.handlePlay}
                                />
                                <StopButton
                                    className='App__playControlButton'
                                    disabled={
                                        this.state.runningState === 'stopped'
                                        || this.state.runningState === 'stopRequested'}
                                    onClick={this.handleStop}/>
                                <ProgramSpeedController
                                    rangeControlRef={this.speedControlRef}
                                    values={this.speedLookUp}
                                    onChange={this.handleChangeProgramSpeed}
                                />
                            </div>
                        </div>
                        <div className='App__shareButton-container'>
                            <button
                                className='App__ShareButton'
                                onClick={this.handleShareButtonClick}
                            >
                                <ShareIcon className='App__ShareButton__icon'/>
                                <div className='App__ShareButton__label'>
                                    {this.props.intl.formatMessage({id:'ShareButton'})}
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
                <CharacterAriaLive
                    ariaLiveRegionId='character-position'
                    ariaHidden={this.state.showWorldSelector}
                    characterState={this.state.characterState}
                    runningState={this.state.runningState}
                    world={this.state.settings.world}/>
                <RobotConnectionErrorModal
                    show={this.state.showRobotConnectionError}
                    onCancel={this.handleCancelArduinoConnection}
                    onRetry={this.handleClickConnectArduino}/>
                <KeyboardInputModal
                    show={this.state.showKeyboardModal}
                    keyBindingsEnabled={this.state.keyBindingsEnabled}
                    keyboardInputSchemeName={this.state.keyboardInputSchemeName}
                    onChangeKeyboardInputScheme={this.handleChangeKeyboardInputScheme}
                    onChangeKeyBindingsEnabled={this.handleChangeKeyBindingsEnabled}
                    onHide={this.handleKeyboardModalClose}
                />
                <SoundOptionsModal
                    audioEnabled={this.state.audioEnabled}
                    announcementsEnabled={this.state.announcementsEnabled}
                    sonificationEnabled={this.state.sonificationEnabled}
                    show={this.state.showSoundOptionsModal}
                    onCancel={this.handleSoundOptionsModalClose}
                    onChangeSoundOptions={this.handleChangeSoundOptions}
                />
                <ThemeSelector
                    show={this.state.showThemeSelectorModal}
                    currentTheme={this.state.settings.theme}
                    onSelect={this.handleSelectTheme}
                    onChange={this.handleChangeTheme}/>
                <WorldSelector
                    show={this.state.showWorldSelector}
                    currentWorld={this.state.settings.world}
                    theme={this.state.settings.theme}
                    onChange={this.handleChangeWorld}
                    onSelect={this.handleSelectWorld}/>
                <ShareModal
                    show={this.state.showShareModal}
                    onClose={this.handleCloseShare}
                />
                <ActionsSimplificationModal
                    show={this.state.showActionsSimplificationMenu}
                    onCancel={this.handleCancelActionsSimplificationMenu}
                    onConfirm={this.handleChangeDisallowedActions}
                    disallowedActions={this.state.disallowedActions}
                    programSequence={this.state.programSequence}
                />
                <PrivacyModal
                    show={this.state.showPrivacyModal}
                    onClose={this.handleClosePrivacyModal}
                />
            </React.Fragment>
        );
    }

    componentDidMount() {
        // As long as we have no underlying "default" theme styles, we need to always set this to ensure that the default theme is applied on startup.
        if (document.body) {
            document.body.className = `${this.state.settings.theme}-theme`;
        }

        if (window.location.search != null && window.location.search !== '') {
            const params = new C2lcURLParams(window.location.search);
            const programQuery = params.getProgram();
            const characterStateQuery = params.getCharacterState();
            const themeQuery = params.getTheme();
            const disallowedActionsQuery = params.getDisallowedActions();
            const worldQuery = params.getWorld();
            const startingPositionQuery = params.getStartingPosition();

            if (programQuery != null) {
                try {
                    const parserResult = this.programSerializer.deserialize(programQuery);
                    this.setState({
                        programSequence: ProgramSequence.makeProgramSequenceFromParserResult(parserResult)
                    });
                } catch(err) {
                    /* eslint-disable no-console */
                    console.log(`Error parsing program: ${programQuery}`);
                    console.log(err.toString());
                    /* eslint-enable no-console */
                }
            }

            if (characterStateQuery != null) {
                try {
                    this.setState({
                        characterState: this.characterStateSerializer.deserialize(characterStateQuery)
                    });
                } catch(err) {
                    /* eslint-disable no-console */
                    console.log(`Error parsing characterState: ${characterStateQuery}`);
                    console.log(err.toString());
                    /* eslint-enable no-console */
                }
            }

            if (disallowedActionsQuery != null) {
                try {
                    this.setState({
                        disallowedActions: this.disallowedActionsSerializer.deserialize(disallowedActionsQuery)
                    });
                } catch(err) {
                    /* eslint-disable no-console */
                    console.log(`Error parsing disallowed actions: ${disallowedActionsQuery}`);
                    console.log(err.toString());
                    /* eslint-enable no-console */
                }
            }

            const world = Utils.getWorldFromString(worldQuery, this.defaultWorld);
            const startingPosition = Utils.getStartingPositionFromString(
                startingPositionQuery,
                this.state.sceneDimensions.getMaxX(),
                this.state.sceneDimensions.getMaxY(),
                getWorldProperties(world).startingX,
                getWorldProperties(world).startingY,
                getWorldProperties(world).startingDirection
            );

            this.setState({
                startingX: startingPosition.x,
                startingY: startingPosition.y,
                startingDirection: startingPosition.direction
            });

            this.setStateSettings({
                theme: Utils.getThemeFromString(themeQuery, 'default'),
                world: world
            });
        } else {
            const localProgram = window.localStorage.getItem('c2lc-program');
            const localCharacterState = window.localStorage.getItem('c2lc-characterState');
            const localTheme = window.localStorage.getItem('c2lc-theme');
            const localDisallowedActions = window.localStorage.getItem('c2lc-disallowedActions');
            const localWorld = window.localStorage.getItem('c2lc-world');
            const localStartingPosition = window.localStorage.getItem('c2lc-startingPosition');

            if (localProgram != null) {
                try {
                    const parserResult = this.programSerializer.deserialize(localProgram);
                    this.setState({
                        programSequence: ProgramSequence.makeProgramSequenceFromParserResult(parserResult)
                    });
                } catch(err) {
                    /* eslint-disable no-console */
                    console.log(`Error parsing program: ${localProgram}`);
                    console.log(err.toString());
                    /* eslint-enable no-console */
                }
            }

            if (localCharacterState != null) {
                try {
                    this.setState({
                        characterState: this.characterStateSerializer.deserialize(localCharacterState)
                    });
                } catch(err) {
                    /* eslint-disable no-console */
                    console.log(`Error parsing characterState: ${localCharacterState}`);
                    console.log(err.toString());
                    /* eslint-enable no-console */
                }
            }


            if (localDisallowedActions != null) {
                try {
                    this.setState({
                        disallowedActions: this.disallowedActionsSerializer.deserialize(localDisallowedActions)
                    });
                } catch(err) {
                    /* eslint-disable no-console */
                    console.log(`Error parsing disallowed actions: ${localDisallowedActions}`);
                    console.log(err.toString());
                    /* eslint-enable no-console */
                }
            }

            const world = Utils.getWorldFromString(localWorld, this.defaultWorld);
            const startingPosition = Utils.getStartingPositionFromString(
                localStartingPosition,
                this.state.sceneDimensions.getMaxX(),
                this.state.sceneDimensions.getMaxY(),
                getWorldProperties(world).startingX,
                getWorldProperties(world).startingY,
                getWorldProperties(world).startingDirection
            );

            this.setState({
                startingX: startingPosition.x,
                startingY: startingPosition.y,
                startingDirection: startingPosition.direction
            });

            this.setStateSettings({
                theme: Utils.getThemeFromString(localTheme, 'default'),
                world: world
            });
        }

        // Keyboard settings are read from local storage whether or not we have URL content.
        const localKeyBindingsEnabled = window.localStorage.getItem('c2lc-keyBindingsEnabled');
        const localKeyboardInputSchemeName = window.localStorage.getItem('c2lc-keyboardInputSchemeName');

        if (localKeyBindingsEnabled != null) {
            try {
                this.setState({
                    keyBindingsEnabled: !!(JSON.parse(localKeyBindingsEnabled))
                });
            }
            catch(err) {
                /* eslint-disable no-console */
                console.log(`Error parsing key bindings toggle: ${localKeyBindingsEnabled}`);
                console.log(err.toString());
                /* eslint-enable no-console */
            }
        }

        if (isKeyboardInputSchemeName(localKeyboardInputSchemeName)) {
            this.setState({
                keyboardInputSchemeName: localKeyboardInputSchemeName
            });
        }

        document.addEventListener('keydown', this.handleDocumentKeyDown);
    }

    componentDidUpdate(prevProps: {}, prevState: AppState) {
        if (this.state.programSequence !== prevState.programSequence
            || this.state.characterState !== prevState.characterState
            || this.state.settings.theme !== prevState.settings.theme
            || this.state.disallowedActions !== prevState.disallowedActions
            || this.state.startingX !== prevState.startingX
            || this.state.startingY !== prevState.startingY
            || this.state.startingDirection !== prevState.startingDirection
            || this.state.settings.world !== prevState.settings.world) {
            const serializedProgram = this.programSerializer.serialize(this.state.programSequence.getProgram());
            const serializedCharacterState = this.characterStateSerializer.serialize(this.state.characterState);
            const serializedDisallowedActions = this.disallowedActionsSerializer.serialize(this.state.disallowedActions);
            const serializedStartingPosition = `${Utils.encodeCoordinate(this.state.startingX)}${Utils.encodeCoordinate(this.state.startingY)}${Utils.encodeDirection(this.state.startingDirection)}`;

            // Use setTimeout() to limit how often we call history.pushState().
            // Safari will throw an error if calls to history.pushState() are
            // too frequent: "SecurityError: Attempt to use history.pushState()
            // more than 100 times per 30 seconds".
            const pushStateDelayMs = 350;
            clearTimeout(this.pushStateTimeoutID);
            this.pushStateTimeoutID = setTimeout(() => {
                window.history.pushState(
                    {
                        p: serializedProgram,
                        c: serializedCharacterState,
                        t: this.state.settings.theme,
                        d: serializedDisallowedActions,
                        w: this.state.settings.world,
                        s: serializedStartingPosition
                    },
                    '',
                    Utils.generateEncodedProgramURL(this.version, this.state.settings.theme, this.state.settings.world, serializedProgram, serializedCharacterState, serializedDisallowedActions, serializedStartingPosition),
                    '',
                );
            }, pushStateDelayMs);

            window.localStorage.setItem('c2lc-version', this.version);
            window.localStorage.setItem('c2lc-program', serializedProgram);
            window.localStorage.setItem('c2lc-characterState', serializedCharacterState);
            window.localStorage.setItem('c2lc-theme', this.state.settings.theme);
            window.localStorage.setItem('c2lc-disallowedActions', serializedDisallowedActions);
            window.localStorage.setItem('c2lc-world', this.state.settings.world);
            window.localStorage.setItem('c2lc-startingPosition', serializedStartingPosition);
        }

        if (this.state.keyBindingsEnabled !== prevState.keyBindingsEnabled
            || this.state.keyboardInputSchemeName !== prevState.keyboardInputSchemeName) {
            window.localStorage.setItem('c2lc-keyBindingsEnabled', this.state.keyBindingsEnabled);
            window.localStorage.setItem('c2lc-keyboardInputSchemeName', this.state.keyboardInputSchemeName);
        }

        if (this.state.announcementsEnabled !== prevState.announcementsEnabled) {
            this.audioManager.setAnnouncementsEnabled(this.state.announcementsEnabled);
        }
        if (this.state.audioEnabled !== prevState.audioEnabled) {
            this.audioManager.setAudioEnabled(this.state.audioEnabled);
        }
        if (this.state.sonificationEnabled !== prevState.sonificationEnabled) {
            this.audioManager.setSonificationEnabled(this.state.sonificationEnabled);
        }
        if (this.state.runningState !== prevState.runningState
                && this.state.runningState === 'running') {
            this.interpreter.startRun();
        }

        if (this.state.selectedAction !== prevState.selectedAction
                && this.state.selectedAction != null) {
            const announcementData = this.announcementBuilder.buildSelectActionAnnouncement(this.state.selectedAction);
            this.audioManager.playAnnouncement(announcementData.messageIdSuffix,
                    this.props.intl, announcementData.values);
        }

        if (this.state.programSequence !== prevState.programSequence) {
            if (this.state.programSequence.getProgramLength() === 0) {
                // All steps have been deleted
                this.setState({ runningState: 'stopped' });
            } else if (this.state.programSequence.getProgramCounter()
                    >= this.state.programSequence.getProgramLength()) {
                // All steps from the programCounter onward have been deleted
                this.setState({ runningState: 'stopped' });
            }
        }

        if (this.state.settings.theme !== prevState.settings.theme && document.body) {
            document.body.className = `${this.state.settings.theme}-theme`;
        }

        if (this.state.arduinoConnectionStatus !== prevState.arduinoConnectionStatus) {
            /* eslint-disable no-console */
            console.log(this.state.arduinoConnectionStatus);
            /* eslint-enable no-console */
            if (this.state.arduinoConnectionStatus === 'connected') {
                // TODO: Update how to handle 45 and 90 degree turns
                this.interpreter.addCommandHandler('forward1', 'arduino',
                    this.arduinoDriver.forward.bind(this.arduinoDriver));
                this.interpreter.addCommandHandler('left45', 'arduino',
                    this.arduinoDriver.left45.bind(this.arduinoDriver));
                this.interpreter.addCommandHandler('right45', 'arduino',
                    this.arduinoDriver.right45.bind(this.arduinoDriver));
				this.interpreter.addCommandHandler('left90', 'arduino',
                    this.arduinoDriver.left90.bind(this.arduinoDriver));
                this.interpreter.addCommandHandler('right90', 'arduino',
                    this.arduinoDriver.right90.bind(this.arduinoDriver));
                this.interpreter.addCommandHandler('backward1', 'arduino',
                    this.arduinoDriver.backward.bind(this.arduinoDriver));
            }
        }
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleDocumentKeyDown);
    }
}

export default injectIntl(App);
