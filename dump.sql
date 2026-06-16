--
-- PostgreSQL database dump
--

-- Dumped from database version 16.3 (Debian 16.3-1+b1)
-- Dumped by pg_dump version 16.3 (Debian 16.3-1+b1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: skillmatch_user
--

INSERT INTO public.categories VALUES ('eff5dabc-9000-46e4-bf1a-f6a41c7cef97', 'All', 'grid', '#0061FF', '2026-06-07 21:23:28.031063-04');
INSERT INTO public.categories VALUES ('3995cb1b-2858-4978-80b5-ec48768a72ef', 'Development', 'code', '#6366F1', '2026-06-07 21:23:28.031063-04');
INSERT INTO public.categories VALUES ('dfca8caf-8b41-4cb5-a87f-e966750940d4', 'Design', 'palette', '#EC4899', '2026-06-07 21:23:28.031063-04');
INSERT INTO public.categories VALUES ('bb843606-33e7-48b8-9ad9-2c27181ddf44', 'Writing', 'pencil', '#F59E0B', '2026-06-07 21:23:28.031063-04');
INSERT INTO public.categories VALUES ('8f1a2c0c-ae16-495d-ba1e-acd8d8a1e11a', 'Teaching', 'book-open', '#10B981', '2026-06-07 21:23:28.031063-04');
INSERT INTO public.categories VALUES ('a84e0118-0f32-4b82-a2d1-c4f724e665a9', 'Photography', 'camera', '#8B5CF6', '2026-06-07 21:23:28.031063-04');
INSERT INTO public.categories VALUES ('81ed4d68-0ded-49ce-9226-b0a3d8844416', 'Music', 'music', '#EF4444', '2026-06-07 21:23:28.031063-04');
INSERT INTO public.categories VALUES ('2b523eee-5bb1-44b6-a47a-a8e47fd986d9', 'Fitness', 'dumbbell', '#14B8A6', '2026-06-07 21:23:28.031063-04');
INSERT INTO public.categories VALUES ('d552809b-9c66-4841-bf50-e047be003b8f', 'Cooking', 'utensils', '#F97316', '2026-06-07 21:23:28.031063-04');
INSERT INTO public.categories VALUES ('e9efe2c8-3ca0-44e9-aec2-c592beee377e', 'Repair', 'wrench', '#6B7280', '2026-06-07 21:23:28.031063-04');
INSERT INTO public.categories VALUES ('8bef4b90-9bc4-4a7b-ba53-253e69c43a9f', 'Cleaning', 'sparkles', '#06B6D4', '2026-06-07 21:23:28.031063-04');
INSERT INTO public.categories VALUES ('82420f31-2a9f-4b32-938e-498f09fe239e', 'Driving', 'car', '#84CC16', '2026-06-07 21:23:28.031063-04');
INSERT INTO public.categories VALUES ('49d10495-e3cf-4ad9-b438-c4db58c50921', 'Beauty', 'scissors', '#DB2777', '2026-06-07 21:23:28.031063-04');
INSERT INTO public.categories VALUES ('6635dd59-544c-4e0f-a7a0-12b4591bd59c', 'Translation', 'globe', '#7C3AED', '2026-06-07 21:23:28.031063-04');
INSERT INTO public.categories VALUES ('1c02fc5e-2c80-4897-afdc-0d27a905084a', 'Marketing', 'megaphone', '#0EA5E9', '2026-06-07 21:23:28.031063-04');
INSERT INTO public.categories VALUES ('75069fcf-47c9-4094-8659-b248daa3e068', 'Other', 'more-horizontal', '#9CA3AF', '2026-06-07 21:23:28.031063-04');


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: skillmatch_user
--

INSERT INTO public.users VALUES ('262ed9de-607a-4261-93de-3d3019283386', '654361879', '$2a$10$fEqCEiPtPLcKTIeXe3P6De07o6yMeVRwtxcAJ/lC.wV6ljeEL3M6u', 'Valaine', '/uploads/file-1781317144232-98199144', true, 'en', 'system', '2026-06-12 22:18:41.948354-04', '2026-06-12 22:19:04.282961-04', '2026-06-12 22:18:41.948354-04', NULL);
INSERT INTO public.users VALUES ('74a5f1e8-d4b6-4017-8563-5352978515f8', '1234567890', '$2a$10$PX1FlekMHyZesAKdFHZ9LeC9KoPeF6MMq.y6/If5La4GAUdbmRbUy', 'Alice Smith', NULL, true, 'en', 'system', '2026-06-10 18:54:18.216749-04', '2026-06-10 18:54:18.216749-04', '2026-06-10 18:54:18.216749-04', NULL);
INSERT INTO public.users VALUES ('90e3d6d9-cd47-4c89-adc9-d6ebc9997089', '0987654321', '$2a$10$PX1FlekMHyZesAKdFHZ9LeC9KoPeF6MMq.y6/If5La4GAUdbmRbUy', 'Bob Builder', NULL, true, 'en', 'system', '2026-06-10 18:54:18.22476-04', '2026-06-10 18:54:18.22476-04', '2026-06-10 18:54:18.22476-04', NULL);
INSERT INTO public.users VALUES ('2677d30a-87b3-456d-ac1e-6017aee191a6', '5555555555', '$2a$10$PX1FlekMHyZesAKdFHZ9LeC9KoPeF6MMq.y6/If5La4GAUdbmRbUy', 'Charlie Design', NULL, true, 'en', 'system', '2026-06-10 18:54:18.235992-04', '2026-06-10 18:54:18.235992-04', '2026-06-10 18:54:18.235992-04', NULL);
INSERT INTO public.users VALUES ('2ffe26d4-9c1e-442b-b526-c536d0863adf', '123456789', '$2a$10$M9Yx0TIfinDC96tIvw0yyetr3VW2cIbJ4JtJw/rrmHCNvdxg7.cV6', 'PC USER', '/uploads/file-1781354448968-275004212', true, 'en', 'system', '2026-06-12 21:26:52.889345-04', '2026-06-13 08:40:49.123479-04', '2026-06-12 22:56:00.190665-04', NULL);


--
-- Data for Name: services; Type: TABLE DATA; Schema: public; Owner: skillmatch_user
--

INSERT INTO public.services VALUES ('8cc97c3d-c7d9-4192-b64d-77041f0c06f4', '2ffe26d4-9c1e-442b-b526-c536d0863adf', 'FULL STACK TEST', 'ggsgdgvsg', 'Development', 0.00, 'exchange', 'Yaounde', NULL, NULL, '{/uploads/service-1781314098097-981955576,/uploads/service-1781314098105-626643229,/uploads/service-1781314098109-999353605,/uploads/service-1781314098116-345983509,/uploads/service-1781314098120-857672869,/uploads/service-1781314098122-230052200,/uploads/service-1781314098125-520849871,/uploads/service-1781314098127-639535917}', '{}', 5.0, 1, true, '2026-06-12 21:28:18.184703-04', '2026-06-14 20:39:56.10287-04', 'USD', 'I can fuck', 13.30);
INSERT INTO public.services VALUES ('adb0224e-d60a-4ca0-87a9-86d2c841fa98', '262ed9de-607a-4261-93de-3d3019283386', 'vdvs', 'vsvdvs', 'Design', 0.00, 'fixed', 'ddvsv', NULL, NULL, '{/uploads/file-1781317167892-203075584}', '{}', 5.0, 1, true, '2026-06-12 22:19:27.979449-04', '2026-06-14 20:39:59.873721-04', 'XAF', NULL, 13.30);
INSERT INTO public.services VALUES ('77b72846-2f03-4411-a68c-8832f9da41f9', '2ffe26d4-9c1e-442b-b526-c536d0863adf', 'fdgfdfh', 'r', 'Development', 0.00, 'exchange', 'bherheh', NULL, NULL, '{/uploads/file-1781354496407-52277339}', '{}', 4.0, 1, true, '2026-06-13 08:41:36.466425-04', '2026-06-14 20:40:21.043653-04', 'USD', 'rbsehs', 12.20);
INSERT INTO public.services VALUES ('d82ba98d-4380-44f3-ae75-589c262bff25', '2ffe26d4-9c1e-442b-b526-c536d0863adf', 'HACKER', 'I''m a petester and red teamer', 'Other', 300000.00, 'fixed', 'Yaounde', NULL, NULL, '{/uploads/file-1781349951876-272467700,/uploads/file-1781349951903-164731384}', '{}', 0.0, 0, true, '2026-06-13 07:25:51.953879-04', '2026-06-13 08:44:34.335726-04', 'XAF', NULL, 10.30);


--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: skillmatch_user
--

INSERT INTO public.conversations VALUES ('54a15201-cfe0-403b-97ff-ac547ae5c577', '262ed9de-607a-4261-93de-3d3019283386', '2ffe26d4-9c1e-442b-b526-c536d0863adf', '8cc97c3d-c7d9-4192-b64d-77041f0c06f4', '2026-06-12 22:18:48.038445-04', '2026-06-12 22:18:50.797598-04');
INSERT INTO public.conversations VALUES ('08c531c2-7058-4127-8e44-74d4e147d6da', '2ffe26d4-9c1e-442b-b526-c536d0863adf', '2ffe26d4-9c1e-442b-b526-c536d0863adf', 'd82ba98d-4380-44f3-ae75-589c262bff25', '2026-06-13 08:44:38.851288-04', '2026-06-13 08:45:19.208908-04');


--
-- Data for Name: favorites; Type: TABLE DATA; Schema: public; Owner: skillmatch_user
--

INSERT INTO public.favorites VALUES ('2edf57a8-aae1-4870-a820-ae6de83150eb', '2ffe26d4-9c1e-442b-b526-c536d0863adf', '8cc97c3d-c7d9-4192-b64d-77041f0c06f4', '2026-06-13 07:19:22.25134-04');
INSERT INTO public.favorites VALUES ('98f99b3b-3ac7-4213-a789-8dc4ac17fd55', '2ffe26d4-9c1e-442b-b526-c536d0863adf', 'adb0224e-d60a-4ca0-87a9-86d2c841fa98', '2026-06-13 08:44:15.314231-04');
INSERT INTO public.favorites VALUES ('58e18ccc-403a-4c03-80c8-bc1cc08ffe2d', '2ffe26d4-9c1e-442b-b526-c536d0863adf', 'd82ba98d-4380-44f3-ae75-589c262bff25', '2026-06-13 08:44:34.327296-04');


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: skillmatch_user
--

INSERT INTO public.messages VALUES ('4ab97676-e53e-46c2-bdd5-cca95a31361b', '54a15201-cfe0-403b-97ff-ac547ae5c577', '262ed9de-607a-4261-93de-3d3019283386', 'yjtj', true, '2026-06-12 22:18:50.763749-04');
INSERT INTO public.messages VALUES ('3ba86a4d-f636-499d-9c29-cca8a1699ed5', '08c531c2-7058-4127-8e44-74d4e147d6da', '2ffe26d4-9c1e-442b-b526-c536d0863adf', 'fsdgfgghg', false, '2026-06-13 08:45:19.187759-04');


--
-- Data for Name: reviews; Type: TABLE DATA; Schema: public; Owner: skillmatch_user
--

INSERT INTO public.reviews VALUES ('7224c6ce-997b-46fb-a64c-c1f62be18bc3', '8cc97c3d-c7d9-4192-b64d-77041f0c06f4', '2ffe26d4-9c1e-442b-b526-c536d0863adf', 5, '', '2026-06-12 21:31:10.339218-04');


--
-- PostgreSQL database dump complete
--

