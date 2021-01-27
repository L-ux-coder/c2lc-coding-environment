// @flow

import { injectIntl, FormattedMessage } from 'react-intl';
import type {IntlShape} from 'react-intl';
import type {AudioManager, RunningState} from './types';
import React from 'react';
import ConfirmDeleteAllModal from './ConfirmDeleteAllModal';
import AddNode from './AddNode';
import ActionPanel from './ActionPanel';
import AriaDisablingButton from './AriaDisablingButton';
import FocusTrapManager from './FocusTrapManager';
import CommandBlock from './CommandBlock';
import classNames from 'classnames';
import ProgramSequence from './ProgramSequence';
import ToggleSwitch from './ToggleSwitch';
import { ReactComponent as AddIcon } from './svg/Add.svg';
import { ReactComponent as DeleteAllIcon } from './svg/DeleteAll.svg';
import { ReactComponent as RobotIcon } from './svg/Robot.svg';
import { ReactComponent as SpaceShipIcon } from './svg/SpaceShip.svg';
import { ReactComponent as RabbitIcon } from './svg/Rabbit.svg';
import './ProgramBlockEditor.scss';

// TODO: Send focus to Delete toggle button on close of Delete All confirmation
//       dialog

type ProgramBlockEditorProps = {
    intl: IntlShape,
    actionPanelStepIndex: ?number,
    editingDisabled: boolean,
    programSequence: ProgramSequence,
    runningState: RunningState,
    selectedAction: ?string,
    isDraggingCommand: boolean,
    audioManager: AudioManager,
    focusTrapManager: FocusTrapManager,
    addNodeExpandedMode: boolean,
    theme: string,
    onChangeProgramSequence: (programSequence: ProgramSequence) => void,
    onChangeActionPanelStepIndex: (index: ?number) => void,
    onChangeAddNodeExpandedMode: (boolean) => void
};

type ProgramBlockEditorState = {
    showConfirmDeleteAll: boolean,
    focusedActionPanelOptionName: ?string,
    replaceIsActive: boolean
};

class ProgramBlockEditor extends React.Component<ProgramBlockEditorProps, ProgramBlockEditorState> {
    commandBlockRefs: Map<number, HTMLElement>;
    addNodeRefs: Map<number, HTMLElement>;
    focusCommandBlockIndex: ?number;
    focusAddNodeIndex: ?number;
    scrollToAddNodeIndex: ?number;
    programSequenceContainerRef: { current: null | HTMLDivElement };

    constructor(props: ProgramBlockEditorProps) {
        super(props);
        this.commandBlockRefs = new Map();
        this.addNodeRefs = new Map();
        this.focusCommandBlockIndex = null;
        this.focusAddNodeIndex = null;
        this.scrollToAddNodeIndex = null;
        this.programSequenceContainerRef = React.createRef();
        this.state = {
            showConfirmDeleteAll : false,
            focusedActionPanelOptionName: null,
            replaceIsActive: false
        }
    }

    scrollProgramSequenceContainer(toElement: HTMLElement) {
        if (this.programSequenceContainerRef.current) {
            const containerElem = this.programSequenceContainerRef.current;
            if (toElement != null && toElement.dataset.stepnumber === '0') {
                containerElem.scrollTo(0, 0);
            } else if (toElement != null){
                const containerLeft = containerElem.getBoundingClientRect().left;
                const containerWidth = containerElem.clientWidth;
                const toElementLeft = toElement.getBoundingClientRect().left;
                const toElementRight = toElement.getBoundingClientRect().right;

                if (toElementRight > containerLeft + containerWidth) {
                    // toElement is outside of the container, on the right
                    containerElem.scrollLeft += toElementRight - containerLeft - containerWidth;
                } else if (toElementLeft < containerLeft) {
                    // toElement is outside of the container, on the left
                    containerElem.scrollLeft -= containerLeft - toElementLeft;
                }
            }
        }
    }

    commandIsSelected() {
        return this.props.selectedAction != null;
    }

    insertSelectedCommandIntoProgram(index: number) {
        if (this.props.selectedAction) {
            this.focusCommandBlockIndex = index;
            this.scrollToAddNodeIndex = index + 1;
            this.props.onChangeProgramSequence(
                this.props.programSequence.insertStep(index, this.props.selectedAction)
            );
        }
    }

    programStepIsActive(programStepNumber: number) {
        if (this.props.runningState === 'running') {
            return (this.props.programSequence.getProgramCounter()) === programStepNumber;
        } else {
            return false;
        }
    }

    closeActionPanel() {
        // TODO: Can we set focusedActionPanelOptionName to null in response
        //       to setting actionPanelStepIndex to null? So that we only need
        //       to set actionPanelStepIndex.
        this.setState({
            focusedActionPanelOptionName: null
        });
        this.props.onChangeActionPanelStepIndex(null);
    }

    setCommandBlockRef(programStepNumber: number, element: ?HTMLElement) {
        if (element) {
            this.commandBlockRefs.set(programStepNumber, element);
        } else {
            this.commandBlockRefs.delete(programStepNumber);
        }
    }

    setAddNodeRef(programStepNumber: number, element: ?HTMLElement) {
        if (element) {
            this.addNodeRefs.set(programStepNumber, element);
        }
    }

    // Handlers

    handleClickDeleteAll = () => {
        this.props.audioManager.playAnnouncement('deleteAll', this.props.intl);
        this.setState({
            showConfirmDeleteAll : true
        });
    };

    handleCancelDeleteAll = () => {
        this.setState({
            showConfirmDeleteAll : false
        });
    };

    handleConfirmDeleteAll = () => {
        this.props.onChangeProgramSequence(
            this.props.programSequence.updateProgram([])
        );
        this.setState({
            showConfirmDeleteAll : false
        });
    };

    handleActionPanelDeleteStep = (index: number) => {
        const commandString = this.props.intl.formatMessage({ id: "Announcement." + this.props.programSequence.getProgramStepAt(index)});

        this.props.audioManager.playAnnouncement('delete', this.props.intl, { command: commandString});
        // If there are steps following the one being deleted, focus the
        // next step. Otherwise, focus the final add node.
        if (index < this.props.programSequence.getProgramLength() - 1) {
            this.focusCommandBlockIndex = index;
        } else {
            this.focusAddNodeIndex = index;
        }
        this.props.onChangeProgramSequence(
            this.props.programSequence.deleteStep(index)
        );
        this.closeActionPanel();
    };

    handleActionPanelReplaceStep = (index: number) => {
        const oldCommandString = this.props.intl.formatMessage({ id: "Announcement." + this.props.programSequence.getProgramStepAt(index)});
        const newCommandString = this.props.intl.formatMessage({ id: "Announcement." + (this.props.selectedAction || "") });

        this.props.audioManager.playAnnouncement('replace', this.props.intl, { oldCommand: oldCommandString, newCommand: newCommandString});
        if (this.props.selectedAction) {
            if (
                this.props.selectedAction &&
                this.props.programSequence.getProgramStepAt(index) !== this.props.selectedAction) {
                this.props.onChangeProgramSequence(
                    this.props.programSequence.overwriteStep(index, this.props.selectedAction)
                );
                this.setState({
                    replaceIsActive: false
                });
                this.focusCommandBlockIndex = index;
                this.scrollToAddNodeIndex = index + 1;
            } else {
                this.setState({
                    replaceIsActive: true
                });
            }
        } else {
            this.setState({
                replaceIsActive: true
            });
        }
    };

    handleActionPanelMoveToPreviousStep = (index: number) => {
        this.props.audioManager.playAnnouncement('moveToPrevious', this.props.intl);
        if (this.props.programSequence.getProgramStepAt(index - 1) != null) {
            const previousStepIndex = index - 1;
            this.setState({
                focusedActionPanelOptionName: 'moveToPreviousStep'
            });
            this.props.onChangeActionPanelStepIndex(previousStepIndex);
            this.props.onChangeProgramSequence(
                this.props.programSequence.swapStep(index, previousStepIndex)
            );
        }
    };

    handleActionPanelMoveToNextStep = (index: number) => {
        this.props.audioManager.playAnnouncement('moveToNext', this.props.intl);
        if (this.props.programSequence.getProgramStepAt(index + 1) != null) {
            const nextStepIndex = index + 1;
            this.setState({
                focusedActionPanelOptionName: 'moveToNextStep'
            });
            this.props.onChangeActionPanelStepIndex(nextStepIndex);
            this.props.onChangeProgramSequence(
                this.props.programSequence.swapStep(index, nextStepIndex)
            );
        }
    };

    handleClickStep = (e: SyntheticEvent<HTMLButtonElement>) => {
        const index = parseInt(e.currentTarget.dataset.stepnumber, 10);
        // Open or close the ActionPanel
        if (this.props.actionPanelStepIndex === index) {
            // The ActionPanel is already open for this program step, close it
            this.closeActionPanel();
        } else {
            // Otherwise, open it
            this.props.onChangeActionPanelStepIndex(index);
        }
    };

    handleClickAddNode = (stepNumber: number) => {
        const commandString = this.props.intl.formatMessage({ id: "Announcement." + (this.props.selectedAction || "") });

        this.props.audioManager.playAnnouncement('add', this.props.intl, { command: commandString});
        this.insertSelectedCommandIntoProgram(stepNumber);
    };

    /* istanbul ignore next */
    handleDropCommand = (stepNumber: number) => {
        this.insertSelectedCommandIntoProgram(stepNumber);
    };

    /* istanbul ignore next */
    handleCloseActionPanelFocusTrap = () => {
        this.closeActionPanel();
    };

    /* istanbul ignore next */
    handleCloseReplaceFocusTrap = () => {
        this.setState({
            replaceIsActive: false
        });
    };

    // Rendering

    makeProgramBlock(programStepNumber: number, command: string) {
        const active = this.programStepIsActive(programStepNumber);
        const paused = this.props.runningState === 'paused' &&
            this.props.programSequence.getProgramCounter() === programStepNumber;
        const hasActionPanelControl = this.props.actionPanelStepIndex === programStepNumber;
        const classes = classNames(
            'ProgramBlockEditor__program-block',
            active && 'ProgramBlockEditor__program-block--active',
            hasActionPanelControl && 'focus-trap-action-panel__program-block',
            paused && 'ProgramBlockEditor__program-block--paused'
        );
        const ariaLabel = this.props.intl.formatMessage(
            { id: 'ProgramBlockEditor.command' },
            {
                index: programStepNumber + 1 ,
                command: this.props.intl.formatMessage({id: `Command.${command}`})
            }
        );

        return (
            <CommandBlock
                commandName={command}
                // $FlowFixMe: Limit to specific types of ref.
                ref={ (element) => { this.setCommandBlockRef(programStepNumber, element) } }
                key={`${programStepNumber}-${command}`}
                data-stepnumber={programStepNumber}
                data-command={command}
                data-actionpanelgroup={true}
                className={classes}
                aria-label={ariaLabel}
                aria-controls={hasActionPanelControl ? 'ActionPanel' : undefined}
                aria-expanded={hasActionPanelControl}
                disabled={this.props.editingDisabled}
                onClick={this.handleClickStep}
            />
        );
    }

    makeAddNodeAriaLabel(programStepNumber: number, isEndOfProgramAddNode: boolean) {
        if (this.props.selectedAction != null) {
            if (isEndOfProgramAddNode) {
                return this.props.intl.formatMessage(
                    { id: 'ProgramBlockEditor.lastBlock' },
                    { command: this.props.intl.formatMessage({id: `Command.${this.props.selectedAction}`}) }
                );
            } else if (programStepNumber === 0) {
                // The add node before the start of the program
                return this.props.intl.formatMessage(
                    { id: 'ProgramBlockEditor.beginningBlock' },
                    { command: this.props.intl.formatMessage({id: `Command.${this.props.selectedAction}`}) }
                );
            } else {
                return this.props.intl.formatMessage(
                    { id: 'ProgramBlockEditor.betweenBlocks' },
                    {
                        command: this.props.intl.formatMessage({id: `Command.${this.props.selectedAction}`}),
                        prevCommand: `${programStepNumber}, ${this.props.intl.formatMessage({id: `Command.${this.props.programSequence.getProgramStepAt(programStepNumber-1)}`})}`,
                        postCommand: `${programStepNumber+1}, ${this.props.intl.formatMessage({id: `Command.${this.props.programSequence.getProgramStepAt(programStepNumber)}`})}`
                    }
                );
            }
        } else {
            return this.props.intl.formatMessage(
                { id: 'ProgramBlockEditor.blocks.noCommandSelected'}
            );
        }
    }

    makeProgramBlockSection(programStepNumber: number, command: string) {
        const showActionPanel = (this.props.actionPanelStepIndex === programStepNumber);
        return (
            <React.Fragment key={programStepNumber}>
                <div className='ProgramBlockEditor__program-block-connector'/>
                <AddNode
                    aria-label={this.makeAddNodeAriaLabel(programStepNumber, false)}
                    ref={ (element) => this.setAddNodeRef(programStepNumber, element) }
                    expandedMode={this.props.addNodeExpandedMode}
                    isDraggingCommand={this.props.isDraggingCommand}
                    programStepNumber={programStepNumber}
                    disabled={
                        this.props.editingDisabled ||
                        (!this.commandIsSelected() && !this.props.isDraggingCommand)}
                    onClick={this.handleClickAddNode}
                    onDrop={this.handleDropCommand}
                />
                <div className='ProgramBlockEditor__program-block-connector' />
                <div className='ProgramBlockEditor__program-block-with-panel'>
                    <div className='ProgramBlockEditor__action-panel-container-outer'>
                        {showActionPanel &&
                            <div className='ProgramBlockEditor__action-panel-container-inner'>
                                <ActionPanel
                                    focusedOptionName={this.state.focusedActionPanelOptionName}
                                    selectedCommandName={this.props.selectedAction}
                                    programSequence={this.props.programSequence}
                                    pressedStepIndex={programStepNumber}
                                    onDelete={this.handleActionPanelDeleteStep}
                                    onReplace={this.handleActionPanelReplaceStep}
                                    onMoveToPreviousStep={this.handleActionPanelMoveToPreviousStep}
                                    onMoveToNextStep={this.handleActionPanelMoveToNextStep}/>
                            </div>
                        }
                    </div>
                    {this.makeProgramBlock(programStepNumber, command)}
                </div>
            </React.Fragment>
        );
    }

    makeEndOfProgramAddNodeSection(programStepNumber: number) {
        return (
            <React.Fragment key={'endOfProgramAddNodeSection'}>
                <div className='ProgramBlockEditor__program-block-connector'/>
                <AddNode
                    aria-label={this.makeAddNodeAriaLabel(programStepNumber, true)}
                    ref={ (element) => this.setAddNodeRef(programStepNumber, element) }
                    expandedMode={true}
                    isDraggingCommand={this.props.isDraggingCommand}
                    programStepNumber={programStepNumber}
                    disabled={
                        this.props.editingDisabled ||
                        (!this.commandIsSelected() && !this.props.isDraggingCommand)}
                    onClick={this.handleClickAddNode}
                    onDrop={this.handleDropCommand}
                />
            </React.Fragment>
        )
    }

    getThemedCharacterAriaLabel() {
        if (this.props.theme === 'space') {
            return this.props.intl.formatMessage({id:'ProgramBlockEditor.spaceShipCharacter'});
        } else if (this.props.theme === 'forest') {
            return this.props.intl.formatMessage({id:'ProgramBlockEditor.rabbitCharacter'});
        } else {
            return this.props.intl.formatMessage({id:'ProgramBlockEditor.robotCharacter'});
        }
    }

    getThemedCharacter() {
        if (this.props.theme === 'space') {
            return <SpaceShipIcon className='ProgramBlockEditor__character-column-character' />
        } else if (this.props.theme === 'forest') {
            return <RabbitIcon className='ProgramBlockEditor__character-column-character' />
        } else {
            return <RobotIcon className='ProgramBlockEditor__character-column-character' />
        }
    }

    render() {
        const contents = this.props.programSequence.getProgram().map((command, stepNumber) => {
            return this.makeProgramBlockSection(stepNumber, command);
        });

        contents.push(this.makeEndOfProgramAddNodeSection(this.props.programSequence.getProgramLength()));

        return (
            <div className='ProgramBlockEditor__container'>
                <div className='ProgramBlockEditor__header'>
                    <h2 className='ProgramBlockEditor__heading'>
                        <FormattedMessage id='ProgramBlockEditor.programHeading' />
                    </h2>
                    <div className='ProgramBlockEditor__options'>
                        <ToggleSwitch
                            ariaLabel={this.props.intl.formatMessage({id:'ProgramBlockEditor.toggleAddNodeExpandMode'})}
                            value={this.props.addNodeExpandedMode}
                            onChange={this.props.onChangeAddNodeExpandedMode}
                            contentsTrue={<AddIcon />}
                            contentsFalse={<AddIcon />}
                            className='ProgramBlockEditor__add-node-toggle-switch'
                        />
                        <span className='ProgramBlockEditor__program-deleteAll'>
                            <AriaDisablingButton
                                aria-label={this.props.intl.formatMessage({id:'ProgramBlockEditor.program.deleteAll'})}
                                className='ProgramBlockEditor__program-deleteAll-button'
                                disabledClassName='ProgramBlockEditor__program-deleteAll-button--disabled'
                                disabled={this.props.editingDisabled}
                                onClick={this.handleClickDeleteAll}
                                key='deleteButton'
                            >
                                <DeleteAllIcon className='ProgramBlockEditor__program-deleteAll-button-svg'/>
                            </AriaDisablingButton>
                        </span>
                    </div>
                </div>
                <div className='ProgramBlockEditor__character-column'>
                    <h3>
                        <div
                            className='ProgramBlockEditor__character-column-character-container'
                            role='img'
                            aria-label={this.getThemedCharacterAriaLabel()}>
                            {this.getThemedCharacter()}
                        </div>
                    </h3>
                </div>
                <div className='ProgramBlockEditor__program-sequence-scroll-container' ref={this.programSequenceContainerRef}>
                    <div className='ProgramBlockEditor__program-sequence'>
                        <div className='ProgramBlockEditor__start-indicator'>
                            {this.props.intl.formatMessage({id:'ProgramBlockEditor.startIndicator'})}
                        </div>
                        {contents}
                    </div>
                </div>
                <ConfirmDeleteAllModal
                    show={this.state.showConfirmDeleteAll}
                    onCancel={this.handleCancelDeleteAll}
                    onConfirm={this.handleConfirmDeleteAll}/>
            </div>
        );
    }

    componentDidUpdate() {
        if (this.scrollToAddNodeIndex != null) {
            const element = this.addNodeRefs.get(this.scrollToAddNodeIndex);
            if (element && element.scrollIntoView) {
                element.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
            }
            this.scrollToAddNodeIndex = null;
        }
        if (this.focusCommandBlockIndex != null) {
            const element = this.commandBlockRefs.get(this.focusCommandBlockIndex);
            if (element) {
                element.focus();
            }
            this.focusCommandBlockIndex = null;
        }
        if (this.focusAddNodeIndex != null) {
            const addNode = this.addNodeRefs.get(this.focusAddNodeIndex);
            if (addNode) {
                addNode.focus();
            }
            this.focusAddNodeIndex = null;
        }
        if (this.props.runningState === 'running') {
            const activeProgramStepNum = this.props.programSequence.getProgramCounter();

            const activeProgramStep = this.commandBlockRefs.get(activeProgramStepNum);
            const nextProgramStep = this.commandBlockRefs.get(activeProgramStepNum + 1);
            const lastAddNode = this.addNodeRefs.get(this.props.programSequence.getProgramLength());
            if (activeProgramStep && activeProgramStepNum === 0) {
                this.scrollProgramSequenceContainer(activeProgramStep);
            } else if (nextProgramStep) {
                this.scrollProgramSequenceContainer(nextProgramStep);
            } else if (lastAddNode){
                this.scrollProgramSequenceContainer(lastAddNode);
            }
        }
        if (this.props.actionPanelStepIndex != null) {
            if (this.state.replaceIsActive) {
                this.props.focusTrapManager.setFocusTrap(
                    this.handleCloseReplaceFocusTrap,
                    [
                        '.focus-trap-action-panel-replace__replace_button',
                        '.focus-trap-action-panel-replace__command_button'
                    ],
                    '.focus-trap-action-panel-replace__replace_button'
                );
            } else {
                this.props.focusTrapManager.setFocusTrap(
                    this.handleCloseActionPanelFocusTrap,
                    [
                        '.focus-trap-action-panel__program-block',
                        '.focus-trap-action-panel__action-panel-button'
                    ],
                    '.focus-trap-action-panel__program-block'
                );
            }
        } else {
            this.props.focusTrapManager.unsetFocusTrap();
        }
    }
}

export default injectIntl(ProgramBlockEditor);
