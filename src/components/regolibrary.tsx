import CodeEditor from "./editor.tsx";
import BasicTabs from "./tabs";
import * as React from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';

import { useState } from "react";
import { Library } from "../regolibrary-utils/rego";
import Typography from "@mui/material/Typography";
import recursiveJsonPatch from '../regolibrary-utils/jsonpatch';
import bundleUrl from './bin/kubescape_regolibrary_bundle_wasm.tar.gz'

interface Lib {
    library: Library;
}

function patchObject(obj: any, path: string, value: any) {
    try {
        const fixed = recursiveJsonPatch(obj, path, value);
        return fixed;
    } catch (e) {
        console.log("Failed to path object: ", obj, path, value);
    }
}

const KubescapeRegoLibrary = ({ }) => {
    const [loaded, setLoaded] = useState(false);
    const [target, setTarget] = useState({
        scope: "",
        value: "",
    });

    const [lib, setLibrary] = useState<Lib>({ library: new Library() });
    const [result, setResult] = useState({});
    const [status, setStatus] = useState("");
    const [fix, setFix] = useState(null);
    const [loadError, setLoadError] = useState(null);

    if (loadError) {
        return (
            <Box sx={{ width: '100%' }}>
                <Typography variant="h6" component="div" gutterBottom>
                    Error loading library.
                </Typography>
            </Box>
        )
    }
    if (!loaded) {
        fetch(bundleUrl)
            .then(response => response.arrayBuffer())
            .then(bytes => lib.library.load(bytes))
            .then(() => setLoaded(true))
            .catch((err) => { console.log(err); setLoadError(err) });
    }

    const onTargetChange = (target) => {
        console.log("target changed", target);
        setStatus("");
        setTarget(target);
    }

    const handleResults = (results, input) => {
        console.log("handleResults", results, target);
        setResult(results);
        var status = "Pass";

        var failedControls = [];
        if (target.scope === "frameworks") {
            for (const [controlID, control] of Object.entries(results.results)) {
                if (control.results.length > 0) {
                    status = "Fail";
                    failedControls.push(control);
                }
            }
        }


        if (target.scope === "controls") {
            const rs = results.results;
            if (rs.length > 0) {
                status = "Fail";
                failedControls.push(results);
            }
        }

        setStatus(status);
        if (status === "Pass") {
            setFix(null);
            return;
        }

        var fixed = null;
        for (const control of failedControls) {
            for (const r of control.results) {

                if (!r.fixPaths || r.fixPaths.length === 0) {
                    continue;
                }

                for (const path of r.fixPaths) {
                    if (fixed == null) {
                        fixed = input;
                    }
                    fixed = patchObject(fixed, path.path, path.value);
                }
            }
        }
        setFix(fixed);
    }

    const onEval = (input) => {
        console.log("onEval", input);
        console.log("target", target);
        // console.log(lib.library[target.scope]);
        try {
            const rs = lib.library[target.scope][target.value].eval(input)
            console.log(rs);
            handleResults(rs, input);
        } catch (err) {
            console.log(err);
        }
    }

    const onApplyFix = (f) => {
        console.log("onApplyFix", f);
        setFix(null);
    }


    if (!loaded) {
        return (
            <Box
                sx={{
                    // Center the children
                    alignSelf: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Typography variant="h4" component="div" gutterBottom>
                    The Kubescape Rego Library is loading...
                </Typography>
                <LinearProgress />
            </Box>
        );
    }

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                p: 2,
            }}
        >
            <BasicTabs
                library={lib.library}
                onSelect={onTargetChange}
            />
            <Box
                sx={{
                    width: '100%',
                    padding: 2,
                }}
            >

                <Box
                    sx={{
                        // fixed position
                        position: 'fixed',
                        top: 20,
                        right: 20,
                        zIndex: 1000,
                    }}
                >

                    <CodeEditor
                        onExec={(target.scope && target.value) ? onEval : null}
                        onApplyChanges={onApplyFix}
                        status={status}
                        fixed={fix}
                    />
                </Box>
            </Box>
        </Box>
    )
}

export default KubescapeRegoLibrary;