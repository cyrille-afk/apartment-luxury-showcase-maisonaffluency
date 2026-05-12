UPDATE public.onboarding_tour_steps
SET body = 'You are now on the install guide. Follow the iPhone or Android steps below — for iOS tap the Share button in Safari then "Add to Home Screen"; for Android open the Chrome menu (⋮) then "Add to Home screen". Maison Affluency will then launch like a native app.'
WHERE step_key = 'install-phone';