(function () {
    var root = document.documentElement;
    var topbar = document.querySelector('.sf-topbar');
    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var heroSection = document.querySelector('.sf-hero');
    var heroCopy = document.querySelector('.sf-hero-copy');
    var heroPanel = document.querySelector('.sf-hero-panel');
    var workflowSection = document.querySelector('.sf-workflow-section');
    var workflowPinWrap = document.querySelector('.sf-workflow-pin-wrap');
    var workflowShell = document.querySelector('.sf-workflow-shell');
    var workflowTrack = document.querySelector('.sf-workflow-track');
    var workflowList = document.querySelector('.sf-workflow-list');
    var stageIndex = document.querySelector('[data-stage-index]');
    var stageTitle = document.querySelector('[data-stage-title]');
    var stageCopy = document.querySelector('[data-stage-copy]');
    var stageFill = document.querySelector('.sf-stage-fill');
    var stageMarkers = Array.prototype.slice.call(document.querySelectorAll('[data-stage-marker]'));
    var workflowSteps = Array.prototype.slice.call(document.querySelectorAll('.sf-workflow-step'));
    var activeWorkflowStep = -1;
    var workflowMode = 'vertical';
    var workflowSyncFrame = 0;
    var workflowWheelLockUntil = 0;
    var workflowWheelThrottleMs = 500;
    var workflowWheelDeltaThreshold = 90;
    var workflowWheelDeltaBuffer = 0;
    var workflowWheelBufferReset = 0;
    var workflowAutoIdleMs = 5000;
    var workflowAutoStepMs = 5000;
    var workflowAutoStartTimer = 0;
    var workflowAutoStepTimer = 0;
    var workflowAutoDirection = 1;
    var workflowAutoRunning = false;
    var workflowEdgeMask = 24;

    function getTopbarOffset() {
        return topbar ? topbar.offsetHeight + 32 : 128;
    }

    function clampProgress(progress) {
        return Math.max(0.18, Math.min(1, progress || 0.18));
    }

    function setStageProgress(progress) {
        if (!stageFill) {
            return;
        }

        stageFill.style.setProperty('--sf-stage-progress', clampProgress(progress).toFixed(3));
    }

    function updateWorkflowEdgePadding() {
        var lastStep;
        var trailingPad;

        if (!workflowTrack || !workflowList || workflowSteps.length === 0) {
            return;
        }

        lastStep = workflowSteps[workflowSteps.length - 1];
        trailingPad = Math.max(0, workflowTrack.clientWidth - lastStep.offsetWidth - workflowEdgeMask);

        workflowList.style.setProperty('--sf-workflow-leading-pad', workflowEdgeMask + 'px');
        workflowList.style.setProperty('--sf-workflow-trailing-pad', trailingPad + 'px');
    }

    function getHorizontalTravelDistance() {
        if (!workflowTrack || !workflowList) {
            return 0;
        }

        updateWorkflowEdgePadding();

        return Math.max(0, workflowList.scrollWidth - workflowTrack.clientWidth);
    }

    function getStepTranslateTarget(step) {
        var travelDistance;

        if (!step || !workflowTrack) {
            return 0;
        }

        travelDistance = getHorizontalTravelDistance();

        return Math.max(0, Math.min(
            travelDistance,
            step.offsetLeft - workflowEdgeMask
        ));
    }

    function getHorizontalTranslateRatio() {
        var travelDistance;

        if (!workflowTrack) {
            return 0;
        }

        travelDistance = getHorizontalTravelDistance();

        if (!travelDistance) {
            return 0;
        }

        return Math.max(0, Math.min(1, workflowTrack.scrollLeft / travelDistance));
    }

    function scrollWorkflowToStep(stepNumber, behavior) {
        var targetStep = workflowSteps[stepNumber];

        if (!targetStep || !workflowTrack) {
            return;
        }

        workflowTrack.scrollTo({
            left: getStepTranslateTarget(targetStep),
            top: 0,
            behavior: prefersReducedMotion.matches ? 'auto' : (behavior || 'smooth')
        });
    }

    function syncWorkflowState() {
        if (workflowMode !== 'horizontal') {
            return;
        }

        setStageProgress(0.18 + (getHorizontalTranslateRatio() * 0.82));
        syncHorizontalActiveStep();
    }

    function getWorkflowActiveStep() {
        return Math.max(0, Math.min(workflowSteps.length - 1, activeWorkflowStep < 0 ? 0 : activeWorkflowStep));
    }

    function clearWorkflowAutoStartTimer() {
        if (workflowAutoStartTimer) {
            window.clearTimeout(workflowAutoStartTimer);
            workflowAutoStartTimer = 0;
        }
    }

    function clearWorkflowAutoStepTimer() {
        if (workflowAutoStepTimer) {
            window.clearTimeout(workflowAutoStepTimer);
            workflowAutoStepTimer = 0;
        }
    }

    function stopWorkflowAuto() {
        workflowAutoRunning = false;
        clearWorkflowAutoStepTimer();
    }

    function resetWorkflowAuto() {
        clearWorkflowAutoStartTimer();
        stopWorkflowAuto();
        workflowAutoDirection = 1;
    }

    function runWorkflowAutoStep() {
        var currentStep;
        var nextStep;

        if (!workflowAutoRunning || workflowMode !== 'horizontal' || workflowSteps.length < 2) {
            stopWorkflowAuto();
            return;
        }

        currentStep = getWorkflowActiveStep();
        nextStep = currentStep + workflowAutoDirection;

        if (nextStep >= workflowSteps.length) {
            workflowAutoDirection = -1;
            nextStep = currentStep - 1;
        } else if (nextStep < 0) {
            workflowAutoDirection = 1;
            nextStep = currentStep + 1;
        }

        if (nextStep < 0 || nextStep >= workflowSteps.length || nextStep === currentStep) {
            stopWorkflowAuto();
            return;
        }

        scrollWorkflowToStep(nextStep, 'smooth');
        setStepState(nextStep, false);

        clearWorkflowAutoStepTimer();
        workflowAutoStepTimer = window.setTimeout(runWorkflowAutoStep, workflowAutoStepMs);
    }

    function scheduleWorkflowAutoStart() {
        clearWorkflowAutoStartTimer();

        if (prefersReducedMotion.matches || workflowMode !== 'horizontal' || workflowSteps.length < 2) {
            return;
        }

        workflowAutoStartTimer = window.setTimeout(function () {
            if (workflowMode !== 'horizontal' || workflowSteps.length < 2) {
                return;
            }

            workflowAutoRunning = true;
            runWorkflowAutoStep();
        }, workflowAutoIdleMs);
    }

    function markWorkflowActivity() {
        resetWorkflowAuto();
        scheduleWorkflowAutoStart();
    }

    function setStepState(stepNumber, animate) {
        var step = workflowSteps[stepNumber];

        if (!step || !stageIndex || !stageTitle || !stageCopy) {
            return;
        }

        if (stepNumber === activeWorkflowStep) {
            return;
        }

        activeWorkflowStep = stepNumber;

        workflowSteps.forEach(function (item, index) {
            item.classList.toggle('is-active', index === stepNumber);
        });

        stageMarkers.forEach(function (marker, index) {
            marker.classList.toggle('is-active', index === stepNumber);
        });

        function applyStageCopy() {
            stageIndex.textContent = step.getAttribute('data-step-index') || '01';
            stageTitle.textContent = step.getAttribute('data-step-title') || '';
            stageCopy.textContent = step.getAttribute('data-step-copy') || '';
        }

        if (!window.gsap || !animate || prefersReducedMotion.matches) {
            applyStageCopy();
            return;
        }

        window.gsap.killTweensOf([stageIndex, stageTitle, stageCopy]);

        window.gsap.timeline()
            .to([stageIndex, stageTitle, stageCopy], {
                y: 10,
                opacity: 0,
                duration: 0.18,
                ease: 'power1.in',
                stagger: 0.03
            })
            .add(applyStageCopy)
            .to([stageIndex, stageTitle, stageCopy], {
                y: 0,
                opacity: 1,
                duration: 0.36,
                ease: 'power2.out',
                stagger: 0.04
            });
    }

    function initStageMarkerNavigation() {
        stageMarkers.forEach(function (marker, index) {
            marker.addEventListener('click', function () {
                var targetStep = workflowSteps[index];
                var travelDistance;
                var targetTranslate;
                var targetRatio;
                var stepTop;
                var targetTop;

                if (!targetStep) {
                    return;
                }

                if (workflowMode === 'horizontal' && workflowTrack && workflowList) {
                    markWorkflowActivity();

                    travelDistance = Math.max(1, getHorizontalTravelDistance());
                    targetTranslate = getStepTranslateTarget(targetStep);
                    targetRatio = targetTranslate / travelDistance;
                    scrollWorkflowToStep(index, 'smooth');

                    setStepState(index, false);
                    setStageProgress(0.18 + (targetRatio * 0.82));
                    return;
                }

                stepTop = targetStep.getBoundingClientRect().top + window.pageYOffset;
                targetTop = window.innerWidth <= 1080
                    ? stepTop - getTopbarOffset()
                    : stepTop - (window.innerHeight * 0.48);

                window.scrollTo({
                    top: Math.max(0, targetTop),
                    behavior: prefersReducedMotion.matches ? 'auto' : 'smooth',
                    left: 0
                });

                setStepState(index, true);
                setStageProgress(workflowSteps.length > 1 ? index / (workflowSteps.length - 1) : 1);
            });
        });
    }

    function syncHorizontalActiveStep() {
        var currentX;
        var viewportAnchor;
        var closestIndex = 0;
        var closestDistance = Number.POSITIVE_INFINITY;

        if (!workflowTrack) {
            return;
        }

        currentX = workflowTrack.scrollLeft;
        viewportAnchor = currentX + (workflowTrack.clientWidth * 0.5);

        workflowSteps.forEach(function (step, index) {
            var stepAnchor = step.offsetLeft + (step.offsetWidth * 0.5);
            var distance = Math.abs(stepAnchor - viewportAnchor);

            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = index;
            }
        });

        setStepState(closestIndex, true);
    }

    function initWorkflow(scrollTrigger, gsap) {
        var media = gsap.matchMedia();

        media.add('(min-width: 1081px)', function () {
            var handleTrackScroll;
            var handleWorkflowWheel;
            var handleWorkflowKeydown;
            var handleResize;
            var activeStep;

            if (!workflowSection || !workflowPinWrap || !workflowTrack || !workflowList) {
                return;
            }

            workflowMode = 'horizontal';
            activeWorkflowStep = -1;
            resetWorkflowAuto();
            workflowSection.classList.add('is-horizontal');
            setStageProgress(0.18);
            setStepState(0, false);

            handleTrackScroll = function () {
                if (workflowSyncFrame) {
                    return;
                }

                workflowSyncFrame = window.requestAnimationFrame(function () {
                    workflowSyncFrame = 0;
                    syncWorkflowState();
                });
            };

            handleWorkflowWheel = function (event) {
                var delta;
                var normalizedDelta;
                var currentStep;
                var nextStep;
                var now = Date.now();
                var wheelTarget;

                wheelTarget = event.target && event.target.closest
                    ? event.target.closest('.sf-workflow-track, .sf-stage')
                    : null;

                if (!wheelTarget || !workflowShell.contains(wheelTarget)) {
                    return;
                }

                delta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
                    ? event.deltaX
                    : event.deltaY;

                normalizedDelta = delta;

                if (event.deltaMode === 1) {
                    normalizedDelta = delta * 16;
                } else if (event.deltaMode === 2) {
                    normalizedDelta = delta * window.innerHeight;
                }

                if (!normalizedDelta) {
                    return;
                }

                markWorkflowActivity();

                if (workflowWheelDeltaBuffer && Math.sign(normalizedDelta) !== Math.sign(workflowWheelDeltaBuffer)) {
                    workflowWheelDeltaBuffer = 0;
                }

                workflowWheelDeltaBuffer += normalizedDelta;

                window.clearTimeout(workflowWheelBufferReset);
                workflowWheelBufferReset = window.setTimeout(function () {
                    workflowWheelDeltaBuffer = 0;
                }, 140);

                currentStep = getWorkflowActiveStep();
                nextStep = currentStep + (normalizedDelta > 0 ? 1 : -1);

                if (nextStep < 0 || nextStep >= workflowSteps.length) {
                    workflowWheelDeltaBuffer = 0;
                    workflowWheelLockUntil = 0;
                    window.clearTimeout(workflowWheelBufferReset);
                    return;
                }

                if (now < workflowWheelLockUntil) {
                    event.preventDefault();
                    return;
                }

                if (Math.abs(workflowWheelDeltaBuffer) < workflowWheelDeltaThreshold) {
                    event.preventDefault();
                    return;
                }

                event.preventDefault();
                workflowWheelDeltaBuffer = 0;
                workflowWheelLockUntil = now + workflowWheelThrottleMs;
                scrollWorkflowToStep(nextStep, 'smooth');
                setStepState(nextStep, false);
            };

            handleWorkflowKeydown = function (event) {
                var nextStep = activeWorkflowStep;

                if (workflowMode !== 'horizontal') {
                    return;
                }

                if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'PageDown') {
                    nextStep = Math.min(workflowSteps.length - 1, activeWorkflowStep + 1);
                } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp') {
                    nextStep = Math.max(0, activeWorkflowStep - 1);
                } else {
                    return;
                }

                markWorkflowActivity();
                event.preventDefault();
                scrollWorkflowToStep(nextStep, 'smooth');
                setStepState(nextStep, false);
            };

            handleResize = function () {
                activeStep = Math.max(activeWorkflowStep, 0);
                updateWorkflowEdgePadding();
                scrollWorkflowToStep(activeStep, 'auto');
                syncWorkflowState();
            };

            workflowShell.addEventListener('wheel', handleWorkflowWheel, { passive: false });
            workflowTrack.addEventListener('scroll', handleTrackScroll, { passive: true });
            workflowTrack.addEventListener('keydown', handleWorkflowKeydown);
            window.addEventListener('resize', handleResize);
            handleResize();
            scheduleWorkflowAutoStart();

            return function () {
                workflowMode = 'vertical';
                if (workflowSyncFrame) {
                    window.cancelAnimationFrame(workflowSyncFrame);
                    workflowSyncFrame = 0;
                }
                workflowShell.removeEventListener('wheel', handleWorkflowWheel);
                workflowTrack.removeEventListener('scroll', handleTrackScroll);
                workflowTrack.removeEventListener('keydown', handleWorkflowKeydown);
                window.removeEventListener('resize', handleResize);
                activeWorkflowStep = -1;
                workflowWheelLockUntil = 0;
                workflowWheelDeltaBuffer = 0;
                window.clearTimeout(workflowWheelBufferReset);
                resetWorkflowAuto();
                workflowSection.classList.remove('is-horizontal');
                workflowTrack.scrollTo({ left: 0, top: 0, behavior: 'auto' });
                setStageProgress(0.18);
                setStepState(0, false);
            };
        });

        media.add('(max-width: 1080px)', function () {
            workflowMode = 'vertical';
            activeWorkflowStep = -1;
            workflowWheelLockUntil = 0;
            workflowWheelDeltaBuffer = 0;
            window.clearTimeout(workflowWheelBufferReset);
            resetWorkflowAuto();
            workflowSection.classList.remove('is-horizontal');
            setStageProgress(0.18);
            setStepState(0, false);

            workflowSteps.forEach(function (step, index) {
                scrollTrigger.create({
                    trigger: step,
                    start: 'top center',
                    end: 'bottom center',
                    onEnter: function () {
                        setStepState(index, true);
                    },
                    onEnterBack: function () {
                        setStepState(index, true);
                    }
                });

                gsap.from(step, {
                    y: 42,
                    opacity: 0,
                    duration: 0.78,
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: step,
                        start: 'top 82%',
                        once: true
                    }
                });
            });

            if (workflowList) {
                scrollTrigger.create({
                    trigger: workflowList,
                    start: 'top center',
                    end: 'bottom bottom',
                    onUpdate: function (self) {
                        setStageProgress(0.18 + (self.progress * 0.82));
                    }
                });
            }
        });
    }

    function initHeroScroll(gsap) {
        if (!heroSection || !heroCopy || !heroPanel) {
            return;
        }

        gsap.to(heroCopy, {
            yPercent: -8,
            ease: 'none',
            scrollTrigger: {
                trigger: heroSection,
                start: 'top top',
                end: 'bottom top',
                scrub: true
            }
        });

        gsap.to(heroPanel, {
            yPercent: -4,
            ease: 'none',
            scrollTrigger: {
                trigger: heroSection,
                start: 'top top',
                end: 'bottom top',
                scrub: true
            }
        });
    }

    function initIntro(gsap) {
        gsap.timeline({
            defaults: {
                ease: 'power3.out'
            }
        })
            .from('[data-intro="eyebrow"]', {
                y: 18,
                opacity: 0,
                duration: 0.48
            })
            .from('.sf-hero-title .line', {
                yPercent: 110,
                opacity: 0,
                duration: 0.98,
                stagger: 0.12
            }, '-=0.18')
            .from('[data-intro="lede"]', {
                y: 24,
                opacity: 0,
                duration: 0.64
            }, '-=0.62')
            .from('[data-intro="actions"] .sf-button', {
                y: 18,
                opacity: 0,
                duration: 0.54,
                stagger: 0.08
            }, '-=0.38')
            .from('[data-intro="signals"] .sf-signal-card', {
                y: 18,
                opacity: 0,
                duration: 0.62,
                stagger: 0.08
            }, '-=0.36')
            .from('[data-intro="panel"] > *', {
                y: 24,
                opacity: 0,
                duration: 0.74,
                stagger: 0.1
            }, '-=0.74');
    }

    function initReveals(gsap) {
        gsap.utils.toArray('[data-reveal]').forEach(function (item) {
            gsap.from(item, {
                y: 40,
                opacity: 0,
                duration: 0.8,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: item,
                    start: 'top 84%',
                    once: true
                }
            });
        });

        gsap.utils.toArray('.sf-meter span').forEach(function (meter) {
            gsap.from(meter, {
                scaleX: 0,
                duration: 0.82,
                ease: 'power2.out',
                transformOrigin: 'left center',
                scrollTrigger: {
                    trigger: meter.closest('.sf-capability-card'),
                    start: 'top 84%',
                    once: true
                }
            });
        });
    }

    function initAmbient(gsap) {
        gsap.to('.sf-grid-glow', {
            xPercent: 4,
            yPercent: -6,
            duration: 16,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut'
        });

        gsap.to('.sf-grid-scan', {
            yPercent: 34,
            duration: 12,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut'
        });

        gsap.to('.sf-wordmark-mark', {
            scale: 1.08,
            boxShadow: '0 0 0 10px rgba(152, 221, 255, 0.07), 0 0 34px rgba(152, 221, 255, 0.56)',
            duration: 1.8,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut'
        });

        gsap.to('.sf-system-radar', {
            rotation: 10,
            transformOrigin: 'center center',
            duration: 18,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut'
        });

        gsap.to('.sf-stage-orbit', {
            rotation: -12,
            transformOrigin: 'center center',
            duration: 20,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut'
        });
    }

    function initMotion() {
        setStepState(0, false);
        setStageProgress(0.18);
        initStageMarkerNavigation();

        if (!window.gsap || !window.ScrollTrigger || prefersReducedMotion.matches) {
            root.classList.add('sf-motion-bypassed');
            return;
        }

        window.gsap.registerPlugin(window.ScrollTrigger);

        initIntro(window.gsap);
        initHeroScroll(window.gsap);
        initReveals(window.gsap);
        initWorkflow(window.ScrollTrigger, window.gsap);
        initAmbient(window.gsap);
        window.ScrollTrigger.refresh();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMotion, { once: true });
    } else {
        initMotion();
    }
})();